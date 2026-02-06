"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getKycImage = exports.submitKyc = exports.updateKycStatus = exports.adminListKyc = exports.getMyKyc = void 0;
const prisma_1 = require("../utils/prisma");
const zod_1 = require("zod");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const fs_1 = __importDefault(require("fs"));
const kycUpload_1 = require("../middlewares/kycUpload");
const crypto_1 = require("../utils/crypto");
dotenv_1.default.config();
const BASE_URL = process.env.BASE_URL ?? "https://api.tradovate.com";
const bodySchema = zod_1.z.object({
    status: zod_1.z.enum(["approved", "rejected", "pending"]).transform((s) => s.toUpperCase()), // accepts lowercase on input, transforms to UPPERCASE for DB
    reason: zod_1.z.string().optional().nullable(),
});
// schema for optional body fields
const submitKycSchema = zod_1.z.object({
    idType: zod_1.z.string().optional(),
    country: zod_1.z.string().optional(),
});
const getMyKyc = async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const kyc = await prisma_1.prisma.kyc.findUnique({ where: { userId } });
        if (!kyc) {
            return res.status(404).json({ error: "KYC not found" });
        }
        return res.json({
            id: kyc.id,
            userId: kyc.userId,
            status: kyc.status,
            createdAt: kyc.createdAt,
            reviewedAt: kyc.reviewedAt,
            // ✅ return filenames only
            frontImage: kyc.frontImage, // e.g. "1704123-abc.enc"
            backImage: kyc.backImage,
        });
    }
    catch (error) {
        console.error("getMyKyc error:", error);
        return res.status(500).json({ error: "Failed to fetch KYC" });
    }
};
exports.getMyKyc = getMyKyc;
// Admin handlers (approve/reject/list)
const adminListKyc = async (req, res) => {
    try {
        const records = await prisma_1.prisma.kyc.findMany({
            orderBy: { createdAt: "desc" },
            include: {
                user: {
                    select: { id: true, email: true },
                },
            },
        });
        return res.json({
            success: true,
            kyc: records.map((r) => ({
                id: r.id,
                userId: r.userId,
                status: r.status,
                createdAt: r.createdAt,
                reviewedAt: r.reviewedAt,
                user: r.user,
                // ✅ filenames only
                frontImage: r.frontImage,
                backImage: r.backImage,
            })),
        });
    }
    catch (error) {
        console.error("adminListKyc error:", error);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch KYC records",
        });
    }
};
exports.adminListKyc = adminListKyc;
const updateKycStatus = async (req, res) => {
    try {
        const id = req.params.id;
        const adminId = req.user?.userId ?? null;
        // Validate body
        const parsed = bodySchema.parse(req.body);
        const statusUpper = parsed.status;
        const reason = parsed.reason ?? undefined;
        // Ensure KYC exists
        const existing = await prisma_1.prisma.kyc.findUnique({
            where: { id },
            include: { user: { select: { id: true, email: true } } },
        });
        if (!existing) {
            return res.status(404).json({ success: false, error: "KYC record not found" });
        }
        // Determine user's kycStatus update value
        let userKycStatus = "PENDING";
        if (statusUpper === "APPROVED")
            userKycStatus = "APPROVED";
        else if (statusUpper === "REJECTED")
            userKycStatus = "REJECTED";
        else
            userKycStatus = "PENDING";
        // Perform atomic updates: update Kyc and user's kycStatus
        const [updatedKyc] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.kyc.update({
                where: { id },
                data: {
                    status: statusUpper,
                    reason: statusUpper === "REJECTED" ? reason : null,
                    reviewedBy: adminId ?? undefined,
                    reviewedAt: new Date(),
                },
                include: { user: { select: { id: true, email: true } } },
            }),
            prisma_1.prisma.user.update({
                where: { id: existing.userId },
                data: {
                    kycStatus: userKycStatus,
                },
            }),
        ]);
        // Compose absolute image URLs for response (do not overwrite DB)
        const frontImageUrl = updatedKyc.frontImage ? `${BASE_URL}${updatedKyc.frontImage}` : null;
        const backImageUrl = updatedKyc.backImage ? `${BASE_URL}${updatedKyc.backImage}` : null;
        const frontendMessage = statusUpper === "APPROVED"
            ? "KYC approved successfully"
            : statusUpper === "REJECTED"
                ? "KYC rejected"
                : "KYC status updated";
        return res.json({
            success: true,
            frontendMessage,
            kyc: {
                ...updatedKyc,
                frontImage: frontImageUrl,
                backImage: backImageUrl,
            },
        });
    }
    catch (err) {
        // Zod validation error
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ success: false, error: "Invalid input", details: err.errors });
        }
        console.error("updateKycStatus error", err);
        return res.status(500).json({ success: false, error: "Failed to update KYC" });
    }
};
exports.updateKycStatus = updateKycStatus;
const submitKyc = async (req, res) => {
    try {
        const userId = req.user.userId;
        const files = req.files;
        if (!files?.front?.[0] || !files?.back?.[0]) {
            return res.status(400).json({ error: "Front and back required" });
        }
        const existing = await prisma_1.prisma.kyc.findUnique({ where: { userId } });
        if (existing && existing.status !== "REJECTED") {
            return res.status(409).json({ error: "KYC already submitted" });
        }
        if (existing?.status === "REJECTED") {
            await prisma_1.prisma.kyc.delete({ where: { userId } });
        }
        const frontFile = (0, kycUpload_1.encryptAndMove)(userId, files.front[0]);
        const backFile = (0, kycUpload_1.encryptAndMove)(userId, files.back[0]);
        const kyc = await prisma_1.prisma.kyc.create({
            data: {
                userId,
                status: "PENDING",
                frontImage: frontFile,
                backImage: backFile,
            },
        });
        await prisma_1.prisma.user.update({
            where: { id: userId },
            data: { kycStatus: "PENDING" },
        });
        return res.status(201).json({
            success: true,
            kyc: {
                id: kyc.id,
                status: kyc.status,
                userId,
            },
        });
    }
    catch (err) {
        console.error(err);
        return res.status(500).json({ error: "Failed to submit KYC" });
    }
};
exports.submitKyc = submitKyc;
const getKycImage = async (req, res) => {
    const { userId, filename } = req.params;
    const isAdmin = req.user?.role === "ADMIN";
    const isOwner = req.user?.userId === userId;
    if (!isAdmin && !isOwner) {
        return res.status(403).json({ error: "Forbidden" });
    }
    const filePath = path_1.default.join(process.cwd(), "private_uploads", "kyc", userId, filename);
    if (!fs_1.default.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    (0, crypto_1.decryptFileToStream)(filePath, res);
};
exports.getKycImage = getKycImage;
