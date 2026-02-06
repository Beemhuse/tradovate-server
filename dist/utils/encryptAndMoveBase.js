"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encryptAndMoveBase = encryptAndMoveBase;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const crypto_1 = require("./crypto");
/**
 * Core encrypted upload logic
 * (used by KYC & Certificates)
 */
function encryptAndMoveBase(baseFolder, userId, file) {
    const userDir = path_1.default.join(process.cwd(), "private_uploads", baseFolder, userId);
    fs_1.default.mkdirSync(userDir, { recursive: true });
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.enc`;
    const targetPath = path_1.default.join(userDir, filename);
    (0, crypto_1.encryptFile)(file.path, targetPath);
    return filename;
}
