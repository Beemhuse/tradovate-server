import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/authMiddleware";
import {
  createCoin,
  updateCoin,
  deleteCoin,
  linkCoinToNetwork,
  getAllUsersWithWallets,
  getUserById,
  updateUserWallet,
  unlinkCoinFromNetwork,
  getCoinNetworks,
  getAllCoins,
  getCoinById,
  // deactivateCoin,
  suspendUser,
  toggleCoinStatus,
  deactivateCoin,
  reactivateCoin,
} from "../controllers/adminController";
import {
  adminGetOrders,
  adminSettleOrder,
} from "../controllers/orderController";

const router = Router();

// Protect all admin routes
router.use(authenticateToken, requireRole("ADMIN"));

// =============== COIN MANAGEMENT ROUTES ===============

/**
 * @swagger
 * /admin/coins:
 *   post:
 *     summary: Create a new cryptocurrency coin
 *     description: Add a new coin to the platform for trading and deposits
 *     tags: [Admin - Coins]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - symbol
 *               - name
 *             properties:
 *               symbol:
 *                 type: string
 *                 example: "BTC"
 *                 description: Coin symbol (uppercase)
 *               name:
 *                 type: string
 *                 example: "Bitcoin"
 *                 description: Coin name
 *               iconUrl:
 *                 type: string
 *                 example: "https://cryptologos.cc/logos/bitcoin-btc-logo.png"
 *                 description: URL to coin icon
 *               isActive:
 *                 type: boolean
 *                 example: true
 *                 default: true
 *                 description: Whether the coin is active
 *     responses:
 *       201:
 *         description: Coin created successfully
 *       400:
 *         description: Validation error
 *       409:
 *         description: Coin with same symbol already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 */
router.post("/coins", createCoin);

/**
 * @swagger
 * /admin/coins:
 *   get:
 *     summary: Get all coins
 *     description: Retrieve all coins with their networks and statistics
 *     tags: [Admin - Coins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: includeInactive
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Include inactive coins
 *         example: "false"
 *     responses:
 *       200:
 *         description: List of coins retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 */
router.get("/coins", getAllCoins);

/**
 * @swagger
 * /admin/coins/{id}:
 *   get:
 *     summary: Get coin by ID
 *     description: Retrieve detailed information about a specific coin
 *     tags: [Admin - Coins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coin ID
 *     responses:
 *       200:
 *         description: Coin details retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Coin not found
 */
router.get("/coins/:id", getCoinById);

/**
 * @swagger
 * /admin/coins/{id}:
 *   put:
 *     summary: Update a coin
 *     description: Update coin information
 *     tags: [Admin - Coins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *             properties:
 *               symbol:
 *                 type: string
 *                 example: "BTC"
 *                 description: Coin symbol (uppercase)
 *               name:
 *                 type: string
 *                 example: "Bitcoin"
 *                 description: Coin name
 *               iconUrl:
 *                 type: string
 *                 example: "https://cryptologos.cc/logos/bitcoin-btc-logo.png"
 *                 description: URL to coin icon
 *               isActive:
 *                 type: boolean
 *                 example: true
 *                 description: Whether the coin is active
 *     responses:
 *       200:
 *         description: Coin updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Coin not found
 *       409:
 *         description: Symbol conflict
 */
router.patch("/coins/:id", updateCoin);

/**
 * @swagger
 * /admin/coins/toggle-coins:
 *   patch:
 *     summary: Toggle coin active status
 *     description: |
 *       Toggles a coin between active and inactive states.
 *       This is a soft operation and does not delete any data.
 *       Optionally toggles all associated network mappings.
 *     tags: [Admin - Coins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coin ID
 *       - in: query
 *         name: toggleNetworks
 *         schema:
 *           type: string
 *           enum: [true, false]
 *           default: "true"
 *         description: Toggle the active status of all associated networks
 *     responses:
 *       200:
 *         description: Coin status toggled successfully
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
 *                   example: Coin activated successfully
 *                 details:
 *                   type: object
 *                   properties:
 *                     coin:
 *                       type: string
 *                       example: Bitcoin
 *                     symbol:
 *                       type: string
 *                       example: BTC
 *                     isActive:
 *                       type: boolean
 *                       example: true
 *                     walletsAffected:
 *                       type: number
 *                       example: 120
 *                     ordersAffected:
 *                       type: number
 *                       example: 45
 *                     networksAffected:
 *                       type: number
 *                       example: 3
 *                     networksToggled:
 *                       type: boolean
 *                       example: true
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Coin not found
 *       500:
 *         description: Failed to toggle coin status
 */

router.patch("/toggle/coins/status", toggleCoinStatus);

/**
 * @swagger
 * /admin/coins/{id}:
 *   delete:
 *     summary: Permanently delete a coin
 *     description: Hard delete - removes coin and its associations from database
 *     tags: [Admin - Coins]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Coin ID
 *       - in: query
 *         name: force
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Force delete even if coin has active references
 *         default: "false"
 *     responses:
 *       200:
 *         description: Coin deleted permanently
 *       400:
 *         description: Cannot delete coin with active references
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Coin not found
 */
router.delete("/coins/:id/delete", deleteCoin);

// =============== COIN-NETWORK LINK MANAGEMENT ===============

/**
 * @swagger
 * /admin/coin-network:
 *   post:
 *     summary: Link a coin to a network
 *     description: Associate a coin with a blockchain network
 *     tags: [Admin - Coin-Network]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - coinId
 *               - networkId
 *             properties:
 *               coinId:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *                 description: Coin ID
 *               networkId:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174001"
 *                 description: Network ID
 *               contractAddress:
 *                 type: string
 *                 example: "0xdAC17F958D2ee523a2206206994597C13D831ec7"
 *                 description: Smart contract address (for tokens)
 *               decimals:
 *                 type: integer
 *                 example: 18
 *                 default: 18
 *                 description: Token decimals
 *     responses:
 *       201:
 *         description: Coin linked to network successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Coin or network not found
 *       409:
 *         description: Link already exists or contract address conflict
 */
router.post("/coin-network", linkCoinToNetwork);

/**
 * @swagger
 * /admin/coin-network/{coinId}/{networkId}:
 *   delete:
 *     summary: Unlink coin from network
 *     description: Remove association between a coin and network
 *     tags: [Admin - Coin-Network]
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
 *         description: Coin unlinked from network successfully
 *       400:
 *         description: Cannot unlink (active wallets exist)
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Link not found
 */
router.delete("/coin-network/:coinId/:networkId", unlinkCoinFromNetwork);

/**
 * @swagger
 * /admin/coin-network/{coinId}:
 *   get:
 *     summary: Get networks for a coin
 *     description: Retrieve all networks associated with a specific coin
 *     tags: [Admin - Coin-Network]
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
 *     responses:
 *       200:
 *         description: Networks retrieved successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Coin not found
 */
router.get("/coin-network/:coinId", getCoinNetworks);

// =============== USER MANAGEMENT ROUTES ===============

/**
 * @swagger
 * /admin/users:
 *   get:
 *     summary: Get all users with wallets
 *     description: Retrieve all users with their wallet information and recent transactions
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Users per page
 *       - in: query
 *         name: verified
 *         schema:
 *           type: string
 *           enum: [true, false, all]
 *         description: Filter by verification status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by email or user ID
 *     responses:
 *       200:
 *         description: List of users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   email:
 *                     type: string
 *                   isVerified:
 *                     type: boolean
 *                   role:
 *                     type: string
 *                   createdAt:
 *                     type: string
 *                     format: date-time
 *                   wallets:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Wallet'
 *                   transactions:
 *                     type: array
 *                     items:
 *                       $ref: '#/components/schemas/Transaction'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 */
router.get("/users", getAllUsersWithWallets);

/**
 * @swagger
 * /admin/users/{id}:
 *   get:
 *     summary: Get user by ID
 *     description: Retrieve detailed information about a specific user
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User ID
 *     responses:
 *       200:
 *         description: User details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 id:
 *                   type: string
 *                 email:
 *                   type: string
 *                 isVerified:
 *                   type: boolean
 *                 role:
 *                   type: string
 *                 kycStatus:
 *                   type: string
 *                 createdAt:
 *                   type: string
 *                   format: date-time
 *                 wallets:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Wallet'
 *                 transactions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Transaction'
 *                 kyc:
 *                   $ref: '#/components/schemas/KYC'
 *                 orders:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Order'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: User not found
 */
router.get("/users/:id", getUserById);

/**
 * @swagger
 * /admin/wallet/update:
 *   post:
 *     summary: Update user wallet balance
 *     description: Manually update a user's wallet balance (admin override)
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - walletId
 *             properties:
 *               walletId:
 *                 type: string
 *                 format: uuid
 *                 example: "123e4567-e89b-12d3-a456-426614174002"
 *                 description: Wallet ID
 *               balance:
 *                 type: number
 *                 format: float
 *                 example: 100.5
 *                 minimum: 0
 *                 description: New balance amount
 *     responses:
 *       200:
 *         description: Wallet balance updated successfully
 *       400:
 *         description: Validation error or invalid balance
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin role required
 *       404:
 *         description: Wallet not found
 */
router.post("/wallet/update", updateUserWallet);

/**
 * @swagger
 * /admin/users/{id}/suspend:
 *   patch:
 *     summary: Suspend or unsuspend a user
 *     description: >
 *       Allows an admin to suspend a user account or remove suspension.
 *       Suspended users are blocked from logging in or performing actions.
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the user to suspend or unsuspend
 *
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - suspend
 *             properties:
 *               suspend:
 *                 type: boolean
 *                 example: true
 *                 description: >
 *                   `true` = suspend user,
 *                   `false` = remove suspension (unsuspend)
 *               reason:
 *                 type: string
 *                 example: "Fraudulent activity detected"
 *                 description: Reason for suspension (optional)
 *
 *     responses:
 *       200:
 *         description: User suspension updated successfully
 *       400:
 *         description: Invalid input payload
 *       401:
 *         description: Unauthorized - Missing or invalid token
 *       403:
 *         description: Forbidden - Admin role required or attempting to suspend another admin
 *       404:
 *         description: User not found
 *       500:
 *         description: Server error while updating suspension status
 */
/**
 * @route   PATCH /admin/coins/:id/deactivate
 */
/**
 * @swagger
 * /admin/coins/{id}/deactivate:
 *   patch:
 *     summary: Deactivate a coin
 *     description: Deactivates a coin only if at least one user wallet exists for it.
 *     tags:
 *       - Coins
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coin deactivated successfully
 *       400:
 *         description: Coin has no wallets or already inactive
 *       404:
 *         description: Coin not found
 *       500:
 *         description: Server error
 */

router.patch("/coins/:id/deactivate", deactivateCoin);

/**
 * @route   PATCH /admin/coins/:id/reactivate
 */
/**
 * @swagger
 * /admin/coins/{id}/reactivate:
 *   patch:
 *     summary: Reactivate a coin
 *     description: Reactivates a previously deactivated coin.
 *     tags:
 *       - Coins
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Coin reactivated successfully
 *       400:
 *         description: Coin already active
 *       404:
 *         description: Coin not found
 *       500:
 *         description: Server error
 */

router.patch("/:id/reactivate", reactivateCoin);
router.patch("/users/:id/suspend", suspendUser);

// =============== ORDER MANAGEMENT ROUTES ===============
router.get("/orders", adminGetOrders);
router.post("/orders/:id/settle", adminSettleOrder);

export default router;
