import express from "express";
import {
  getContactInfo,
  updateContactInfo,
} from "../controllers/contactController";
import { authenticateToken, requireRole } from "../middlewares/authMiddleware";
// import { verifyToken, isAdmin } from "../middlewares/authMiddleware"; // adjust imports as needed

const router = express.Router();

// Public: Get contact info
router.get("/", getContactInfo);

// Admin: Update contact info
// Assuming verifyToken and isAdmin middleware exist
router.post("/", authenticateToken, requireRole("ADMIN"), updateContactInfo);

export default router;
