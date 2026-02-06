import { Router, Request, Response } from "express";
import { certificateUpload } from "../middlewares/certificateUpload";
import {
  adminUploadCertificates,
  deleteCertificate,
  getCertificateImage,
  getCertificates,
} from "../controllers/adminCertController";
import { authenticateToken, requireRole } from "../middlewares/authMiddleware";

const router = Router();

/**
 * POST /admin/certificates
 * Body:
 * - userId (uuid)
 * - certificates[] (multipart images)
 */
/**
 * @swagger
 * /certificates/admin:
 *   post:
 *     tags:
 *       - Certificates
 *     summary: Upload certificate images for a user
 *     description: |
 *       Admin-only endpoint to upload one or multiple certificate images for a user.
 *       Files are encrypted at rest and stored securely.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - certificates
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: User ID to attach certificate(s) to
 *               certificates:
 *                 type: array
 *                 description: One or more certificate image files
 *                 items:
 *                   type: string
 *                   format: binary
 *     responses:
 *       201:
 *         description: Certificates uploaded successfully
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
 *                   example: Certificates uploaded successfully
 *                 certificates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                         format: uuid
 *                       image:
 *                         type: string
 *                         description: Encrypted filename
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Invalid input or no files provided
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden (Admin only)
 *       404:
 *         description: User not found
 *       500:
 *         description: Internal server error
 */

router.post(
  "/admin",
  authenticateToken,
  requireRole("ADMIN"),
  certificateUpload,
  adminUploadCertificates
);

/**
 * @swagger
 * /certificates:
 *   get:
 *     tags:
 *       - Certificates
 *     summary: Get all available certificates
 *     description: Returns a list of globally available certificates
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Certificates fetched successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error
 */
router.get("/", authenticateToken, getCertificates);

/**
 * @swagger
 * /certificates/{id}:
 *   delete:
 *     tags: [Certificates]
 *     summary: Delete a certificate (Admin only)
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Certificate deleted successfully
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Certificate not found
 *       500:
 *         description: Server error
 */
router.delete(
  "/:id",
  authenticateToken,
  requireRole("ADMIN"),
  deleteCertificate
);

/**
 * @swagger
 * /certificates/image/{filename}:
 *   get:
 *     tags:
 *       - Certificates
 *     summary: Get a certificate image
 *     description: |
 *       Securely retrieves and streams a certificate image.
 *       The image is stored encrypted at rest and decrypted on-the-fly.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: filename
 *         required: true
 *         schema:
 *           type: string
 *         description: Encrypted certificate filename
 *     responses:
 *       200:
 *         description: Certificate image streamed successfully
 *         content:
 *           image/webp:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: File not found
 *       500:
 *         description: Internal server error
 */
router.get("/image/:filename", authenticateToken, getCertificateImage);

export default router;
