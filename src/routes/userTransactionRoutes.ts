import { getUserTransactionById, getUserTransactions } from "../controllers/userTransactionsController";
import { Router } from "express";
import { authenticateToken } from "../middlewares/authMiddleware";

const router = Router();

/**
 * User transactions
 */
/**
 * @swagger
 * /user/transactions:
 *   get:
 *     summary: Get user transactions
 *     description: Retrieve all transactions belonging to the authenticated user.
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Transactions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transactions:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Unauthorized
 */

/**
 * @swagger
 * /user/transactions/{id}:
 *   get:
 *     summary: Get transaction by ID
 *     description: Retrieve a single transaction by its ID for the authenticated user.
 *     tags:
 *       - Transactions
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Transaction retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 transaction:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Transaction not found
 */

router.get("/", authenticateToken, getUserTransactions);
router.get("/:id", authenticateToken, getUserTransactionById);

export default router;
