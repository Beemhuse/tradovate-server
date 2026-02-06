import multer from "multer";
import path from "path";
import { encryptAndMoveBase } from "../utils/encryptAndMoveBase";

const upload = multer({
  dest: path.join(process.cwd(), "tmp"),
});

export const kycUpload = upload.fields([
  { name: "front", maxCount: 1 },
  { name: "back", maxCount: 1 },
]);

export function encryptAndMove(
  userId: string,
  file: Express.Multer.File
): string {
  return encryptAndMoveBase("kyc", userId, file);
}
