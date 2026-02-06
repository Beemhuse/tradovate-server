import multer from "multer";
import path from "path";
import { encryptAndMoveBase } from "../utils/encryptAndMoveBase";

const upload = multer({
  dest: path.join(process.cwd(), "tmp"),
});

export const receiptUpload = upload.single("receipt");

export function encryptAndMoveReceipt(
  userId: string,
  file: Express.Multer.File,
): string {
  return encryptAndMoveBase("receipts", userId, file);
}
