// routes/kycRoutes.ts
import express from "express";
import {
  submitKyc,
  getMyKyc,
  adminListKyc,
  updateKycStatus,
  getKycImage,
} from "../controllers/submitKycController";
// import { kycUpload } from "../middlewares/uploadKyc";

import { authenticateToken, requireRole } from "../middlewares/authMiddleware";
import { kycUpload } from "../middlewares/kycUpload";

const router = express.Router();

// =============== USER KYC ROUTES ===============

/**
 * @swagger
 * /kyc:
 *   post:
 *     summary: Submit KYC documents
 *     description: Upload KYC documents (front and back of ID) for verification
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - front
 *               - back
 *             properties:
 *               front:
 *                 type: string
 *                 format: binary
 *                 description: Front side of ID document (image file)
 *               back:
 *                 type: string
 *                 format: binary
 *                 description: Back side of ID document (image file)
 *     responses:
 *       201:
 *         description: KYC documents submitted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "KYC submitted successfully"
 *                 kyc:
 *                   $ref: '#/components/schemas/KYC'
 *       400:
 *         description: Bad request - missing files or invalid format
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Both front and back images are required"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       409:
 *         description: Conflict - KYC already submitted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "KYC already submitted"
 *       413:
 *         description: Payload too large - file size exceeds limit
 *       415:
 *         description: Unsupported media type - invalid file format
 *       500:
 *         description: Internal server error
 */
router.post(
  "/",
  authenticateToken,
  kycUpload,
  submitKyc
);

/**
 * @swagger
 * /kyc/me:
 *   get:
 *     summary: Get current user's KYC status
 *     description: Retrieve the KYC submission status and details for the authenticated user
 *     tags: [KYC]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KYC status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 kyc:
 *                   $ref: '#/components/schemas/KYC'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       404:
 *         description: KYC not found for this user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "KYC not found"
 *       500:
 *         description: Internal server error
 */
router.get("/me", authenticateToken, getMyKyc);

// =============== ADMIN KYC ROUTES ===============

/**
 * @swagger
 * /admin/kyc:
 *   get:
 *     summary: List all KYC submissions (Admin only)
 *     description: Retrieve all KYC submissions with filtering and pagination options
 *     tags: [Admin - KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: Filter by KYC status
 *         example: "PENDING"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number for pagination
 *         example: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *         example: 20
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, updatedAt, reviewedAt]
 *           default: createdAt
 *         description: Field to sort by
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: List of KYC submissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 count:
 *                   type: integer
 *                   example: 25
 *                 total:
 *                   type: integer
 *                   example: 150
 *                 page:
 *                   type: integer
 *                   example: 1
 *                 pages:
 *                   type: integer
 *                   example: 8
 *                 kycs:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/KYCWithUser'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin role required
 *       500:
 *         description: Internal server error
 */
router.get("/admin/list", authenticateToken, requireRole("ADMIN"), adminListKyc);

/**
 * @swagger
 * /admin/{id}/status:
 *   post:
 *     summary: Reject KYC submission (Admin only)
 *     description: Reject a user's KYC submission with optional reason
 *     tags: [Admin - KYC]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: KYC submission ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *                 description: Reason for rejection
 *                 example: "Document quality is poor"
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: KYC rejected successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "KYC rejected successfully"
 *                 kyc:
 *                   $ref: '#/components/schemas/KYC'
 *       400:
 *         description: Reason required for rejection
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Reason is required for rejection"
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: KYC submission not found
 *       409:
 *         description: KYC already processed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "KYC already processed"
 *       500:
 *         description: Internal server error
 */
router.patch("/admin/:id/status", authenticateToken, requireRole("ADMIN"), updateKycStatus);

router.get(
  "/image/:userId/:filename",
  authenticateToken, requireRole("ADMIN"),
  getKycImage
);
export default router;