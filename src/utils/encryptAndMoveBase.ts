import fs from "fs";
import path from "path";
import { encryptFile } from "./crypto";

/**
 * Core encrypted upload logic
 * (used by KYC & Certificates)
 */
export function encryptAndMoveBase(
  baseFolder: "kyc" | "certificates" | "receipts",
  userId: string,
  file: Express.Multer.File,
): string {
  const userDir = path.join(
    process.cwd(),
    "private_uploads",
    baseFolder,
    userId,
  );

  fs.mkdirSync(userDir, { recursive: true });

  const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.enc`;

  const targetPath = path.join(userDir, filename);

  encryptFile(file.path, targetPath);

  return filename;
}
