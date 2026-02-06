"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteCertificate = exports.getCertificateImage = exports.getCertificates = exports.adminUploadCertificates = void 0;
const fs_1 = __importDefault(require("fs"));
const zod_1 = require("zod");
const prisma_1 = require("../utils/prisma");
const certificateUpload_1 = require("../middlewares/certificateUpload");
const crypto_1 = require("../utils/crypto");
const path_1 = __importDefault(require("path"));
const bodySchema = zod_1.z.object({
    userId: zod_1.z.string().uuid(),
});
const adminUploadCertificates = async (req, res) => {
    try {
        // 🔐 Admin only
        if (req.user?.role !== "ADMIN") {
            return res.status(403).json({ error: "Forbidden" });
        }
        const files = req.files;
        if (!files || files.length === 0) {
            return res.status(400).json({
                error: "At least one certificate image is required",
            });
        }
        // Encrypt + move files (GLOBAL certificates)
        const encryptedFiles = files.map((file) => (0, certificateUpload_1.encryptAndMoveCertificate)("global", file));
        // Persist in DB
        const certificates = await prisma_1.prisma.$transaction(encryptedFiles.map((filename) => prisma_1.prisma.certificate.create({
            data: {
                image: filename,
                uploadedBy: req.user.userId,
            },
        })));
        return res.status(201).json({
            success: true,
            message: certificates.length === 1
                ? "Certificate uploaded successfully"
                : "Certificates uploaded successfully",
            certificates: certificates.map((c) => ({
                id: c.id,
                image: c.image,
                createdAt: c.createdAt,
            })),
        });
    }
    catch (err) {
        console.error("adminUploadCertificates error:", err);
        return res.status(500).json({
            error: "Failed to upload certificates",
        });
    }
};
exports.adminUploadCertificates = adminUploadCertificates;
const getCertificates = async (_req, res) => {
    try {
        const certificates = await prisma_1.prisma.certificate.findMany({
            orderBy: { createdAt: "desc" },
            select: {
                id: true,
                image: true,
                createdAt: true,
                uploadedByUser: {
                    select: {
                        id: true,
                        email: true,
                    },
                },
            },
        });
        res.json({
            success: true,
            certificates: certificates.map((c) => ({
                id: c.id,
                image: c.image,
                createdAt: c.createdAt,
                uploadedBy: c.uploadedByUser,
            })),
        });
    }
    catch (error) {
        console.error("getCertificates error:", error);
        res.status(500).json({
            error: "Failed to fetch certificates",
        });
    }
};
exports.getCertificates = getCertificates;
const getCertificateImage = async (req, res) => {
    const { filename } = req.params;
    const filePath = path_1.default.join(process.cwd(), "private_uploads", "certificates", "global", filename);
    if (!fs_1.default.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
    }
    res.setHeader("Content-Type", "image/webp");
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    (0, crypto_1.decryptFileToStream)(filePath, res);
};
exports.getCertificateImage = getCertificateImage;
const deleteCertificate = async (req, res) => {
    try {
        // 🔐 Admin only
        if (req.user?.role !== "ADMIN") {
            return res.status(403).json({ error: "Forbidden" });
        }
        const { id } = req.params;
        // 1️⃣ Find certificate
        const certificate = await prisma_1.prisma.certificate.findUnique({
            where: { id },
        });
        if (!certificate) {
            return res.status(404).json({
                error: "Certificate not found",
            });
        }
        // 2️⃣ Resolve file path
        const filePath = path_1.default.join(process.cwd(), "private_uploads", "certificates", "global", certificate.image);
        // 3️⃣ Delete DB record first (transaction safety)
        await prisma_1.prisma.certificate.delete({
            where: { id },
        });
        // 4️⃣ Delete encrypted file (best effort)
        if (fs_1.default.existsSync(filePath)) {
            fs_1.default.unlinkSync(filePath);
        }
        return res.json({
            success: true,
            message: "Certificate deleted successfully",
        });
    }
    catch (error) {
        console.error("deleteCertificate error:", error);
        return res.status(500).json({
            error: "Failed to delete certificate",
        });
    }
};
exports.deleteCertificate = deleteCertificate;
