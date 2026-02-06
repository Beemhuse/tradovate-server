import { Router } from "express";
import { authenticateToken, requireRole } from "../middlewares/authMiddleware";
import { getCoins, getCoin } from "../controllers/coinController";
import {
  getAssets,
  createWallet,
  requestDeposit,
  requestWithdraw,
  getTransactions,
  requestBankWithdraw,
  getWalletConversions,
  executeConversion,
  getDepositImage,
} from "../controllers/walletController";
import {
  getMarketPrices,
  placeOrder,
  getUserOrders,
} from "../controllers/orderController";
import {
  adminGetPairs,
  createPair,
  deletePair,
  getPairById,
  getPairs,
  updatePair,
  createTradeConfig,
  updateTradeConfig,
  deleteTradeConfig,
} from "../controllers/marketController";
import { receiptUpload } from "../middlewares/receiptUpload";

const router = Router();

/**
 * @swagger
 * /market/coins:
 *   get:
 *     summary: List all active coins
 *     tags: [Market]
 *     responses:
 *       200:
 *         description: List of coins
 */
router.get("/coins", getCoins); // Public

/**
 * @swagger
 * /market/coins/{id}:
 *   get:
 *     summary: Get single coin details
 *     description: Fetch detailed information about a specific coin by ID.
 *     tags: [Market]
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
 *       404:
 *         description: Coin not found
 *       500:
 *         description: Server error
 */

router.get("/coins/:id", getCoin); // Public - single coin details

/**
 * @swagger
 * /market/pairs:
 *   get:
 *     summary: List all market pairs
 *     description: Fetch all active trading pairs (e.g. BTC/USDT).
 *     tags: [Market]
 *     responses:
 *       200:
 *         description: Successfully retrieved market pairs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   symbol:
 *                     type: string
 *                     example: BTC/USDT
 *                   isActive:
 *                     type: boolean
 *                   baseCoin:
 *                     type: object
 *                   quoteCoin:
 *                     type: object
 *       500:
 *         description: Server error
 */

// Public
router.get("/pairs", getPairs);
/**
 * @swagger
 * /market/pairs/{id}:
 *   get:
 *     summary: Get a single market pair by ID
 *     description: Fetch details of a specific trading pair created by admin (e.g. BTC/USDT)
 *     tags: [Market]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Market pair ID
 *     responses:
 *       200:
 *         description: Market pair retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 pair:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "903b4b50-c6f0-4b3b-b53d-4ce407538a3a"
 *                     symbol:
 *                       type: string
 *                       example: "BTC/USDT"
 *                     wsSymbol:
 *                       type: string
 *                       example: "btcusdt"
 *                     isActive:
 *                       type: boolean
 *                     baseCoin:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         symbol:
 *                           type: string
 *                           example: "BTC"
 *                         name:
 *                           type: string
 *                           example: "Bitcoin"
 *                         iconUrl:
 *                           type: string
 *                           nullable: true
 *                     quoteCoin:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         symbol:
 *                           type: string
 *                           example: "USDT"
 *                         name:
 *                           type: string
 *                           example: "Tether"
 *                         iconUrl:
 *                           type: string
 *                           nullable: true
 *       404:
 *         description: Market pair not found
 *       500:
 *         description: Server error
 */

router.get("/pairs/:id", authenticateToken, getPairById);

/**
 * @swagger
 * /market/admin-pairs:
 *   get:
 *     summary: List all market pairs
 *     description: Fetch all active trading pairs (e.g. BTC/USDT).
 *     tags: [Market]
 *     responses:
 *       200:
 *         description: Successfully retrieved market pairs
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                     format: uuid
 *                   symbol:
 *                     type: string
 *                     example: BTC/USDT
 *                   isActive:
 *                     type: boolean
 *                   baseCoin:
 *                     type: object
 *                   quoteCoin:
 *                     type: object
 *       500:
 *         description: Server error
 */

router.get("/admin-pairs", adminGetPairs);

/**
 * @swagger
 * /market/pairs:
 *   post:
 *     summary: Create a market pair
 *     description: Create a new trading pair (e.g. BTC/USDT). Admin only.
 *     tags: [Market - Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - baseCoinId
 *               - quoteCoinId
 *             properties:
 *               baseCoinId:
 *                 type: string
 *                 format: uuid
 *                 description: Base coin ID (e.g. BTC)
 *               quoteCoinId:
 *                 type: string
 *                 format: uuid
 *                 description: Quote coin ID (e.g. USDT)
 *     responses:
 *       201:
 *         description: Market pair created successfully
 *       400:
 *         description: Invalid request or pair already exists
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden – Admin access required
 *       500:
 *         description: Server error
 */

// Admin
router.post("/pairs", authenticateToken, requireRole("ADMIN"), createPair);
/**
 * @swagger
 * /admin/pairs/{id}:
 *   patch:
 *     summary: Update a trading pair
 *     description: Enable or disable a trading pair created by admin
 *     tags: [Admin - Trading Pairs]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               isActive:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       200:
 *         description: Trading pair updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Trading pair not found
 */

// Admin only
router.patch("/pairs/:id", authenticateToken, requireRole("ADMIN"), updatePair);

/**
 * @swagger
 * /market/pairs/{id}:
 *   delete:
 *     summary: Delete a trading pair
 *     description: Permanently remove a trading pair and its configurations. Admin only.
 *     tags: [Market - Admin]
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
 *         description: Trading pair deleted successfully
 *       404:
 *         description: Trading pair not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden
 */
router.delete(
  "/pairs/:id",
  authenticateToken,
  requireRole("ADMIN"),
  deletePair,
);

/**
 * Admin endpoints for Trade Configs (periods)
 */
router.post(
  "/configs",
  authenticateToken,
  requireRole("ADMIN"),
  createTradeConfig,
);

router.patch(
  "/configs/:id",
  authenticateToken,
  requireRole("ADMIN"),
  updateTradeConfig,
);

router.delete(
  "/configs/:id",
  authenticateToken,
  requireRole("ADMIN"),
  deleteTradeConfig,
);

/**
 * @swagger
 * /market/prices:
 *   get:
 *     summary: Get current market prices
 *     tags: [Market]
 *     responses:
 *       200:
 *         description: Live prices
 */
router.get("/prices", getMarketPrices); // Public

// Wallet Routes
router.use(authenticateToken);

/**
 * @swagger
 * /market/assets:
 *   get:
 *     summary: Get user wallets
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User assets
 */
router.get("/assets", getAssets);

/**
 * @swagger
 * /market/wallet:
 *   post:
 *     summary: Create/Get wallet for a coin
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               coinId:
 *                 type: string
 *               networkId:
 *                 type: string
 *     responses:
 *       200:
 *         description: Wallet details
 */
router.post("/wallet", createWallet);

/**
 * @swagger
 * /market/deposit:
 *   post:
 *     summary: Request a deposit
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               walletId:
 *                 type: string
 *               amount:
 *                 type: number
 *     responses:
 *       200:
 *         description: Deposit requested
 */
router.post("/deposit", receiptUpload, requestDeposit);

/**
 * @swagger
 * /market/withdraw:
 *   post:
 *     summary: Request a withdrawal
 *     tags: [Wallet]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               walletId:
 *                 type: string
 *               amount:
 *                 type: number
 *               toAddress:
 *                 type: string
 *     responses:
 *       200:
 *         description: Withdrawal requested
 */
router.post("/withdraw", requestWithdraw);

/**
 * @swagger
 * /market/withdraw/bank:
 *   post:
 *     summary: Request a bank withdrawal
 *     description: Submit a withdrawal request to transfer funds from a user's wallet to a bank account. The endpoint will debit the user's wallet (lock funds) and create a pending transaction for admin processing.
 *     tags: [Wallet]
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
 *               - amount
 *               - bankName
 *               - accountName
 *               - accountNumber
 *               - ifscCode
 *             properties:
 *               walletId:
 *                 type: string
 *                 format: uuid
 *                 description: Wallet ID from which the funds will be debited.
 *                 example: "d161def0-2107-4793-862a-84507d6e9320"
 *               amount:
 *                 type: number
 *                 format: float
 *                 description: Amount to withdraw. Must be <= wallet balance.
 *                 example: 150.75
 *                 minimum: 0
 *               bankName:
 *                 type: string
 *                 description: Name of the beneficiary bank.
 *                 example: "First National Bank"
 *               accountName:
 *                 type: string
 *                 description: Beneficiary account holder name.
 *                 example: "John Doe"
 *               accountNumber:
 *                 type: string
 *                 description: Bank account number (string to allow leading zeros).
 *                 example: "0123456789"
 *               ifscCode:
 *                 type: string
 *                 description: Bank branch IFSC / routing code.
 *                 example: "IFSC0001234"
 *     responses:
 *       200:
 *         description: Bank withdrawal request submitted successfully.
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
 *                   example: "Bank withdrawal request submitted"
 *                 transaction:
 *                   type: object
 *                   description: Created transaction object (status will be PENDING).
 *       400:
 *         description: Validation error, insufficient balance, or other request issues.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Insufficient balance"
 *                 details:
 *                   type: string
 *                   example: "Wallet balance is lower than requested amount"
 *       401:
 *         description: Unauthorized - missing or invalid bearer token.
 *       403:
 *         description: Forbidden - wallet does not belong to authenticated user.
 *       500:
 *         description: Server error while processing the request.
 */
router.post("/withdraw/bank", requestBankWithdraw);

router.get("/transactions", getTransactions);

/**
 * @swagger
 * /market/order:
 *   post:
 *     summary: Place a new order
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               coinId:
 *                 type: string
 *               type:
 *                 type: string
 *                 enum: [BUY, SELL]
 *               amount:
 *                 type: number
 *               price:
 *                 type: number
 *     responses:
 *       200:
 *         description: Order placed
 */
router.post("/order", placeOrder);

/**
 * @swagger
 * /market/orders:
 *   get:
 *     summary: Get user orders
 *     tags: [Market]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User orders
 */
router.get("/orders", getUserOrders);
/**
 * @swagger
 * /market/conversion:
 *   get:
 *     summary: Convert wallet balances using real-time market prices
 *     description: >
 *       Converts user wallet balances using live market prices.
 *       The endpoint supports two modes:
 *
 *       **Portfolio mode (default):**
 *       - Converts the full balance of all wallets owned by the user.
 *
 *       **Single-coin mode:**
 *       - Converts a specified amount of a specific coin owned by the user.
 *       - Requires both `coin` and `amount` query parameters.
 *     tags:
 *       - Wallets
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: to
 *         required: false
 *         schema:
 *           type: string
 *           example: USDT
 *         description: Target currency symbol to convert balances into (default is USDT)
 *       - in: query
 *         name: coin
 *         required: false
 *         schema:
 *           type: string
 *           example: BTC
 *         description: Coin symbol to convert from (required for single-coin conversion)
 *       - in: query
 *         name: amount
 *         required: false
 *         schema:
 *           type: number
 *           example: 0.05
 *         description: Amount of the specified coin to convert (required for single-coin conversion)
 *     responses:
 *       200:
 *         description: Conversion successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 mode:
 *                   type: string
 *                   enum: [portfolio, single]
 *                   example: single
 *                 base:
 *                   type: string
 *                   example: USDT
 *                 totalValue:
 *                   type: number
 *                   example: 2843.42
 *                 wallets:
 *                   type: array
 *                   description: Returned only in portfolio mode
 *                   items:
 *                     type: object
 *                     properties:
 *                       walletId:
 *                         type: string
 *                         example: wallet_123
 *                       coin:
 *                         type: string
 *                         example: BTC
 *                       balance:
 *                         type: number
 *                         example: 0.05
 *                       price:
 *                         type: number
 *                         example: 43000
 *                       value:
 *                         type: number
 *                         example: 2150
 *                       convertedTo:
 *                         type: string
 *                         example: USDT
 *                 from:
 *                   type: string
 *                   example: BTC
 *                 to:
 *                   type: string
 *                   example: USDT
 *                 amount:
 *                   type: number
 *                   example: 0.05
 *                 price:
 *                   type: number
 *                   example: 43000
 *                 value:
 *                   type: number
 *                   example: 2150
 *       400:
 *         description: Invalid request parameters or unsupported currency
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Insufficient balance or wallet not owned by user
 *       500:
 *         description: Failed to convert wallet balances
 */

router.get("/conversion", getWalletConversions);
router.post("/conversion", authenticateToken, executeConversion);

router.get("/image/:userId/:filename", authenticateToken, getDepositImage);
  
export default router;
