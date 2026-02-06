import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/authMiddleware";
import { getAdminDashboard } from "../controllers/adminDashboardController";

const router = Router();

/**
 * @swagger
 * /admin/dashboard:
 *   get:
 *     summary: Admin dashboard metrics
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Dashboard data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 metrics:
 *                   type: object
 *                   properties:
 *                     totalUsers:
 *                       type: number
 *                     activeCoins:
 *                       type: number
 *                     pendingKyc:
 *                       type: number
 *                     tradingVolume:
 *                       type: number
 *                 activity:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                       description:
 *                         type: string
 *                       time:
 *                         type: string
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Admin only
 */

router.get(
  "/dashboard",
  authenticateToken,
  requireRole("ADMIN"),
  getAdminDashboard
);

export default router;
