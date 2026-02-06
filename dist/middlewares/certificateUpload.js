"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.certificateUpload = void 0;
exports.encryptAndMoveCertificate = encryptAndMoveCertificate;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const encryptAndMoveBase_1 = require("../utils/encryptAndMoveBase");
const upload = (0, multer_1.default)({
    dest: path_1.default.join(process.cwd(), "tmp"),
});
/**
 * Accepts:
 * - single image
 * - multiple images
 *
 * field name: "certificates"
 */
exports.certificateUpload = upload.array("certificates", 10);
function encryptAndMoveCertificate(userId, file) {
    return (0, encryptAndMoveBase_1.encryptAndMoveBase)("certificates", userId, file);
}
