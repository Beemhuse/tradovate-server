import fs from "fs";
import { Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma";
import { AuthRequest } from "../middlewares/authMiddleware";
import { encryptAndMoveCertificate } from "../middlewares/certificateUpload";
import { decryptFileToStream } from "../utils/crypto";
import path from "path";
import { RequestHandler } from "express";

const bodySchema = z.object({
  userId: z.string().uuid(),
});

export const adminUploadCertificates = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    // 🔐 Admin only
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const files = req.files as Express.Multer.File[] | undefined;

    if (!files || files.length === 0) {
      return res.status(400).json({
        error: "At least one certificate image is required",
      });
    }

    // Encrypt + move files (GLOBAL certificates)
    const encryptedFiles = files.map((file) =>
      encryptAndMoveCertificate("global", file)
    );

    // Persist in DB
    const certificates = await prisma.$transaction(
      encryptedFiles.map((filename) =>
        prisma.certificate.create({
          data: {
            image: filename,
            uploadedBy: req.user!.userId,
          },
        })
      )
    );

    return res.status(201).json({
      success: true,
      message:
        certificates.length === 1
          ? "Certificate uploaded successfully"
          : "Certificates uploaded successfully",
      certificates: certificates.map((c) => ({
        id: c.id,
        image: c.image,
        createdAt: c.createdAt,
      })),
    });
  } catch (err) {
    console.error("adminUploadCertificates error:", err);
    return res.status(500).json({
      error: "Failed to upload certificates",
    });
  }
};
export const getCertificates: RequestHandler = async (_req, res) => {
  try {
    const certificates = await prisma.certificate.findMany({
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
  } catch (error) {
    console.error("getCertificates error:", error);
    res.status(500).json({
      error: "Failed to fetch certificates",
    });
  }
};


export const getCertificateImage = async (
  req: AuthRequest,
  res: Response
) => {
  const { filename } = req.params;

  const filePath = path.join(
    process.cwd(),
    "private_uploads",
    "certificates",
    "global",
    filename
  );

  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.setHeader("Content-Type", "image/webp");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  decryptFileToStream(filePath, res);
};


export const deleteCertificate = async (
  req: AuthRequest,
  res: Response
) => {
  try {
    // 🔐 Admin only
    if (req.user?.role !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }

    const { id } = req.params;

    // 1️⃣ Find certificate
    const certificate = await prisma.certificate.findUnique({
      where: { id },
    });

    if (!certificate) {
      return res.status(404).json({
        error: "Certificate not found",
      });
    }

    // 2️⃣ Resolve file path
    const filePath = path.join(
      process.cwd(),
      "private_uploads",
      "certificates",
      "global",
      certificate.image
    );

    // 3️⃣ Delete DB record first (transaction safety)
    await prisma.certificate.delete({
      where: { id },
    });

    // 4️⃣ Delete encrypted file (best effort)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    return res.json({
      success: true,
      message: "Certificate deleted successfully",
    });
  } catch (error) {
    console.error("deleteCertificate error:", error);
    return res.status(500).json({
      error: "Failed to delete certificate",
    });
  }
};