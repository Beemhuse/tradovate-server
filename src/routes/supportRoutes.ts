import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/authMiddleware";
import {
  getTickets,
  getAllTickets,
  createTicket,
  replyTicket,
} from "../controllers/supportController";

const router = Router();

router.use(authenticateToken);

router.get("/", getTickets);
router.post("/", createTicket);

// Admin routes
router.get("/all", requireRole("ADMIN"), getAllTickets);
router.patch("/:id/reply", requireRole("ADMIN"), replyTicket);

export default router;
