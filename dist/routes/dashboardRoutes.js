"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const adminDashboardController_1 = require("../controllers/adminDashboardController");
const router = (0, express_1.Router)();
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
router.get("/dashboard", authMiddleware_1.authenticateToken, (0, authMiddleware_1.requireRole)("ADMIN"), adminDashboardController_1.getAdminDashboard);
exports.default = router;
