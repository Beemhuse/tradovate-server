import multer from "multer";
import path from "path";
import { encryptAndMoveBase } from "../utils/encryptAndMoveBase";

const upload = multer({
  dest: path.join(process.cwd(), "tmp"),
});

/**
 * Accepts:
 * - single image
 * - multiple images
 *
 * field name: "certificates"
 */
export const certificateUpload = upload.array("certificates", 10);

export function encryptAndMoveCertificate(
  userId: string,
  file: Express.Multer.File
): string {
  return encryptAndMoveBase("certificates", userId, file);
}


