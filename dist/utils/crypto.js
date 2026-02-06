"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptFile = encryptFile;
exports.decryptFileToStream = decryptFileToStream;
const crypto_1 = __importDefault(require("crypto"));
const fs_1 = __importDefault(require("fs"));
const ALGO = "aes-256-gcm";
const KEY = Buffer.from(process.env.KYC_ENCRYPTION_KEY, "base64");
function encryptFile(inputPath, outputPath) {
    const iv = crypto_1.default.randomBytes(12);
    const cipher = crypto_1.default.createCipheriv(ALGO, KEY, iv);
    const input = fs_1.default.readFileSync(inputPath);
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
    const tag = cipher.getAuthTag();
    fs_1.default.writeFileSync(outputPath, Buffer.concat([iv, tag, encrypted]));
    fs_1.default.unlinkSync(inputPath);
}
function decryptFileToStream(encryptedPath, res) {
    const data = fs_1.default.readFileSync(encryptedPath);
    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const encrypted = data.subarray(28);
    const decipher = crypto_1.default.createDecipheriv(ALGO, KEY, iv);
    decipher.setAuthTag(tag);
    res.write(decipher.update(encrypted));
    res.end(decipher.final());
}
