import express from "express";
import { authenticateToken, requireRole } from './../middlewares/authMiddleware';
import { addCoinNetwork, createNetwork, deactivateNetwork, deleteCoinNetwork, deleteNetwork, getNetworkById, getNetworks, getUSDTByNetwork, updateCoinNetwork, updateNetwork } from "../controllers/networkController";

const router = express.Router();
router.use(authenticateToken, requireRole("ADMIN"));

// =============== NETWORK MANAGEMENT ROUTES ===============

/**
 * @swagger
 * /:
 *   post:
 *     summary: Create a new blockchain network
 *     description: Add a new blockchain network to the platform (Admin only)
 *     tags: [Admin - Networks]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Ethereum Mainnet"
 *                 description: Network name
 *               type:
 *                 type: string
 *                 example: "ERC20"
 *                 description: Network type/token standard
 *               chainId:
 *                 type: string
 *                 example: "1"
 *                 description: Blockchain chain ID
 *               rpcUrl:
 *                 type: string
 *                 example: "https://mainnet.infura.io/v3/YOUR-PROJECT-ID"
 *                 description: RPC endpoint URL
 *               explorerUrl:
 *                 type: string
 *                 example: "https://etherscan.io"
 *                 description: Block explorer URL
 *               isActive:
 *                 type: boolean
 *                 example: true
 *                 default: true
 *                 description: Whether the network is active
 *     responses:
 *       201:
 *         description: Network created successfully
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
 *                   example: "Network created successfully"
 *                 network:
 *                   $ref: '#/components/schemas/Network'
 *       400:
 *         description: Validation error or invalid data
 *       409:
 *         description: Network with same name or type already exists
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin role required
 *       500:
 *         description: Internal server error
 */
router.post("/", requireRole('ADMIN'), createNetwork);
router.get("/:networkId/usdt", requireRole('ADMIN'), getUSDTByNetwork);

/**
 * @swagger
 * /network:
 *   get:
 *     summary: Get all networks
 *     description: Retrieve all blockchain networks (Admin only)
 *     tags: [Admin - Networks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Include inactive networks
 *         example: "false"
 *     responses:
 *       200:
 *         description: List of networks retrieved successfully
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
 *                   example: 5
 *                 networks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Network'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin role required
 *       500:
 *         description: Internal server error
 */
router.get("/list", getNetworks);

/**
 * @swagger
 * /networks/{id}:
 *   get:
 *     summary: Get network by ID
 *     description: Retrieve a specific network by its ID (Admin only)
 *     tags: [Admin - Networks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Network ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Network retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 network:
 *                   $ref: '#/components/schemas/Network'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Network not found
 *       500:
 *         description: Internal server error
 */
router.get("/:id", getNetworkById);

/**
 * @swagger
 * /networks/{id}:
 *   put:
 *     summary: Update network
 *     description: Update an existing blockchain network (Admin only)
 *     tags: [Admin - Networks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Network ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "Updated Network Name"
 *               type:
 *                 type: string
 *                 example: "BEP20"
 *               chainId:
 *                 type: string
 *                 example: "56"
 *               rpcUrl:
 *                 type: string
 *                 example: "https://bsc-dataseed.binance.org/"
 *               explorerUrl:
 *                 type: string
 *                 example: "https://bscscan.com"
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Network updated successfully
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
 *                   example: "Network updated successfully"
 *                 network:
 *                   $ref: '#/components/schemas/Network'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Network not found
 *       500:
 *         description: Internal server error
 */
router.put("/networks/:id", updateNetwork);

/**
 * @swagger
 * /admin/networks/{id}/deactivate:
 *   delete:
 *     summary: Deactivate network
 *     description: Deactivate a network (soft delete) - keeps data but makes it inactive (Admin only)
 *     tags: [Admin - Networks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Network ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Network deactivated successfully
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
 *                   example: "Network deactivated successfully"
 *                 details:
 *                   type: object
 *                   properties:
 *                     network:
 *                       type: string
 *                       example: "Ethereum Mainnet"
 *                     coinsAffected:
 *                       type: integer
 *                       example: 3
 *                     walletsAffected:
 *                       type: integer
 *                       example: 10
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Network not found
 *       500:
 *         description: Internal server error
 */
router.delete("/networks/:id/deactivate", deactivateNetwork);

/**
 * @swagger
 * /admin/networks/{id}:
 *   delete:
 *     summary: Delete network permanently
 *     description: Permanently delete a network and all its associations (Admin only)
 *     tags: [Admin - Networks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Network ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: force
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Force delete even if network has active references
 *         example: "false"
 *     responses:
 *       200:
 *         description: Network deleted permanently
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
 *                   example: "Network deleted permanently"
 *                 details:
 *                   type: object
 *                   properties:
 *                     network:
 *                       type: string
 *                       example: "Ethereum Mainnet"
 *                     forceDeleted:
 *                       type: boolean
 *                       example: false
 *       400:
 *         description: Cannot delete network with active references (unless force=true)
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Network not found
 *       500:
 *         description: Internal server error
 */
router.delete("/networks/:id", deleteNetwork);

/**
 * @swagger
 * /admin/coins/{coinId}/networks:
 *   post:
 *     summary: Add a network to a coin
 *     description: |
 *       Links a blockchain network to a coin.
 *       This does not create a new network — it creates an association.
 *     tags: [Admin - Coin Networks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coinId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coin ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [networkId]
 *             properties:
 *               networkId:
 *                 type: string
 *                 format: uuid
 *                 description: Network ID to associate
 *               contractAddress:
 *                 type: string
 *                 description: Smart contract address (if applicable)
 *                 example: "0x123abc..."
 *               isActive:
 *                 type: boolean
 *                 description: Initial active status for this network
 *                 example: true
 *     responses:
 *       201:
 *         description: Network successfully linked to coin
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Coin or network not found
 *       409:
 *         description: Network already linked to coin
 *       500:
 *         description: Failed to add network to coin
 */

/**
 * @swagger
 * /admin/coins/{coinId}/networks:
 *   patch:
 *     summary: Update coin network configuration
 *     description: |
 *       Updates settings for a network linked to a coin.
 *       Supports toggling active status and updating contract address.
 *     tags: [Admin - Coin Networks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coinId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coin ID
 *       - in: path
 *         name: networkId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Network ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 description: Enable or disable this network for the coin
 *                 example: false
 *               contractAddress:
 *                 type: string
 *                 description: Updated smart contract address
 *                 example: "0xabc456..."
 *     responses:
 *       200:
 *         description: Coin network updated successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Network not linked to coin
 *       500:
 *         description: Failed to update coin network
 */

/**
 * @swagger
 * /admin/coins/{coinId}/networks/{networkId}:
 *   delete:
 *     summary: Remove network from coin
 *     description: |
 *       Unlinks a network from a coin.
 *       This does not delete the network itself.
 *     tags: [Admin - Coin Networks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: coinId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coin ID
 *       - in: path
 *         name: networkId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Network ID
 *     responses:
 *       200:
 *         description: Network successfully removed from coin
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Network not linked to coin
 *       500:
 *         description: Failed to remove network from coin
 */


router.patch(
  "/admin/coins/:coinId/networks/:networkId",
  requireRole("ADMIN"),
  updateCoinNetwork
);

router.delete(
  "/admin/coins/:coinId/networks/:networkId",
  requireRole("ADMIN"),
  deleteCoinNetwork
);

router.post(
"/admin/coins/:coinId/networks",
  requireRole("ADMIN"),
  addCoinNetwork
);

export default router;