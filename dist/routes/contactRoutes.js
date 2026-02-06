"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const contactController_1 = require("../controllers/contactController");
const authMiddleware_1 = require("../middlewares/authMiddleware");
// import { verifyToken, isAdmin } from "../middlewares/authMiddleware"; // adjust imports as needed
const router = express_1.default.Router();
// Public: Get contact info
router.get("/", contactController_1.getContactInfo);
// Admin: Update contact info
// Assuming verifyToken and isAdmin middleware exist
router.post("/", authMiddleware_1.authenticateToken, (0, authMiddleware_1.requireRole)("ADMIN"), contactController_1.updateContactInfo);
exports.default = router;
