"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.kycUpload = void 0;
exports.encryptAndMove = encryptAndMove;
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const encryptAndMoveBase_1 = require("../utils/encryptAndMoveBase");
const upload = (0, multer_1.default)({
    dest: path_1.default.join(process.cwd(), "tmp"),
});
exports.kycUpload = upload.fields([
    { name: "front", maxCount: 1 },
    { name: "back", maxCount: 1 },
]);
function encryptAndMove(userId, file) {
    return (0, encryptAndMoveBase_1.encryptAndMoveBase)("kyc", userId, file);
}
