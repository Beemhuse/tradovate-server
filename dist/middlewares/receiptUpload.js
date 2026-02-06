"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.receiptUpload = void 0;
exports.encryptAndMoveReceipt = encryptAndMoveReceipt;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const encryptAndMoveBase_1 = require("../utils/encryptAndMoveBase");
const upload = (0, multer_1.default)({
    dest: path_1.default.join(process.cwd(), "tmp"),
});
exports.receiptUpload = upload.single("receipt");
function encryptAndMoveReceipt(userId, file) {
    return (0, encryptAndMoveBase_1.encryptAndMoveBase)("receipts", userId, file);
}
