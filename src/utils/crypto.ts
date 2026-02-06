import crypto from "crypto";
import fs from "fs";

const ALGO = "aes-256-gcm";
const KEY = Buffer.from(process.env.KYC_ENCRYPTION_KEY!, "base64");

export function encryptFile(inputPath: string, outputPath: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);

  const input = fs.readFileSync(inputPath);
  const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
  const tag = cipher.getAuthTag();

  fs.writeFileSync(outputPath, Buffer.concat([iv, tag, encrypted]));
  fs.unlinkSync(inputPath);
}

export function decryptFileToStream(
  encryptedPath: string,
  res: NodeJS.WritableStream
) {
  const data = fs.readFileSync(encryptedPath);

  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);

  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);

  res.write(decipher.update(encrypted));
  res.end(decipher.final());
}
