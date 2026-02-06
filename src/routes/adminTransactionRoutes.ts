import { Router } from "express";
import {
  getAllTransactions,
  updateTransactionStatus,
  getReceiptImage,
} from "../controllers/adminTransactionController";
import { authenticateToken, requireRole } from "../middlewares/authMiddleware";

const router = Router();

// Protect all admin routes
router.use(authenticateToken, requireRole("ADMIN"));

router.get("/", getAllTransactions);
router.patch("/:id/status", updateTransactionStatus);
router.get("/receipts/:userId/:filename", getReceiptImage);
/**
 * @swagger
 * tags:
 *   name: Admin Transactions
 *   description: Admin endpoints for managing user transactions
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: Get all user transactions (admin only)
 *     tags: [Admin Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, CANCELLED, all]
 *         required: false
 *         description: Filter by transaction status
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [DEPOSIT, WITHDRAW, BANK_WITHDRAW, TRANSFER, BUY, SELL]
 *         required: false
 *         description: Filter by transaction type
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         required: false
 *         description: Filter transactions belonging to a specific user
 *     responses:
 *       200:
 *         description: List of transactions
 *       401:
 *         description: Unauthorized – Token missing or invalid
 *       403:
 *         description: Forbidden – Only admins can access this resource
 */

/**
 * @swagger
 * /{id}/status:
 *   patch:
 *     summary: Approve a user transaction (admin only)
 *     tags: [Admin Transactions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID to approve
 *     responses:
 *       200:
 *         description: Transaction approved successfully
 *       400:
 *         description: Transaction is not pending or cannot be approved
 *       404:
 *         description: Transaction not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – Only admins can approve transactions
 */
export default router;
