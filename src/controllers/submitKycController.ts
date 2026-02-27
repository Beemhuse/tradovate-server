// src/controllers/submitKycController.ts
import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { z } from "zod";
import path from "path";
import { AuthRequest } from "../middlewares/authMiddleware";
import dotenv from "dotenv";
import fs from "fs";
import { encryptAndMove } from "../middlewares/kycUpload";
import { decryptFileToStream } from "../utils/crypto";

dotenv.config();

const BASE_URL = process.env.BASE_URL ?? "https://api.tradovate.com";
const bodySchema = z.object({
  status: z
    .enum(["approved", "rejected", "pending"])
    .transform((s) => s.toUpperCase()), // accepts lowercase on input, transforms to UPPERCASE for DB
  reason: z.string().optional().nullable(),
});
// Define a Request type that includes multer files
type MulterFiles = {
  front?: Express.Multer.File[];
  back?: Express.Multer.File[];
};

type MulterRequest = Request & {
  files?: MulterFiles;
  user?: { userId: string; id?: string; role?: string }; // Match AuthRequest structure
};

// schema for optional body fields
const submitKycSchema = z.object({
  idType: z.string().optional(),
  country: z.string().optional(),
});

export const getMyKyc = async (req: MulterRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const kyc = await prisma.kyc.findUnique({ where: { userId } });
    if (!kyc) {
      return res.status(404).json({ error: "KYC not found" });
    }

    const baseUrl = process.env.BASE_URL || "http://localhost:9991/api/v1";

    return res.json({
      success: true,
      kyc: {
        id: kyc.id,
        userId: kyc.userId,
        status: kyc.status,
        createdAt: kyc.createdAt,
        reviewedAt: kyc.reviewedAt,
        frontImage: kyc.frontImage ? `${baseUrl}/kyc/image/${userId}/${kyc.frontImage}` : null,
        backImage: kyc.backImage ? `${baseUrl}/kyc/image/${userId}/${kyc.backImage}` : null,
      }
    });
  } catch (error) {
    console.error("getMyKyc error:", error);
    return res.status(500).json({ error: "Failed to fetch KYC" });
  }
};

// Admin handlers (approve/reject/list)
export const adminListKyc = async (req: AuthRequest, res: Response) => {
  try {
    const records = await prisma.kyc.findMany({
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
  } catch (error) {
    console.error("adminListKyc error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch KYC records",
    });
  }
};

export const updateKycStatus = async (req: AuthRequest, res: Response) => {
  try {
    const id = req.params.id;
    const adminId = req.user?.userId ?? null;

    // Validate body
    const parsed = bodySchema.parse(req.body);
    const statusUpper = parsed.status as "APPROVED" | "REJECTED" | "PENDING";
    const reason = parsed.reason ?? undefined;

    // Ensure KYC exists
    const existing = await prisma.kyc.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!existing) {
      return res
        .status(404)
        .json({ success: false, error: "KYC record not found" });
    }

    // Determine user's kycStatus update value
    let userKycStatus: "APPROVED" | "REJECTED" | "PENDING" = "PENDING";
    if (statusUpper === "APPROVED") userKycStatus = "APPROVED";
    else if (statusUpper === "REJECTED") userKycStatus = "REJECTED";
    else userKycStatus = "PENDING";

    // Perform atomic updates: update Kyc and user's kycStatus
    const [updatedKyc] = await prisma.$transaction([
      prisma.kyc.update({
        where: { id },
        data: {
          status: statusUpper,
          reason: statusUpper === "REJECTED" ? reason : null,
          reviewedBy: adminId ?? undefined,
          reviewedAt: new Date(),
        },
        include: { user: { select: { id: true, email: true } } },
      }),
      prisma.user.update({
        where: { id: existing.userId },
        data: {
          kycStatus: userKycStatus,
        },
      }),
    ]);

    // Compose absolute image URLs for response (do not overwrite DB)
    const frontImageUrl = updatedKyc.frontImage
      ? `${BASE_URL}${updatedKyc.frontImage}`
      : null;
    const backImageUrl = updatedKyc.backImage
      ? `${BASE_URL}${updatedKyc.backImage}`
      : null;

    const frontendMessage =
      statusUpper === "APPROVED"
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
  } catch (err: any) {
    // Zod validation error
    if (err instanceof z.ZodError) {
      return res
        .status(400)
        .json({ success: false, error: "Invalid input", details: err.errors });
    }

    console.error("updateKycStatus error", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to update KYC" });
  }
};

export const submitKyc = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const files = req.files as any;

    if (!files?.front?.[0] || !files?.back?.[0]) {
      return res.status(400).json({ error: "Front and back required" });
    }

    const existing = await prisma.kyc.findUnique({ where: { userId } });

    if (existing && existing.status !== "REJECTED") {
      return res.status(409).json({ error: "KYC already submitted" });
    }

    if (existing?.status === "REJECTED") {
      await prisma.kyc.delete({ where: { userId } });
    }

    const frontFile = encryptAndMove(userId, files.front[0]);
    const backFile = encryptAndMove(userId, files.back[0]);

    const kyc = await prisma.kyc.create({
      data: {
        userId,
        status: "PENDING",
        frontImage: frontFile,
        backImage: backFile,
      },
    });

    await prisma.user.update({
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
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Failed to submit KYC" });
  }
};

export const getKycImage = async (req: AuthRequest, res: Response) => {
  const { userId, filename } = req.params;

  const isAdmin = req.user?.role === "ADMIN";
  const isOwner = req.user?.userId === userId;

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const filePath = path.join(
    process.cwd(),
    "private_uploads",
    "kyc",
    userId,
    filename,
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.setHeader("Content-Type", "image/webp");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  decryptFileToStream(filePath, res);
};
