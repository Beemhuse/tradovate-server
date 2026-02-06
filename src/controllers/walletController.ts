import fs from "fs";
import {  Response } from "express";
import { prisma } from "../utils/prisma";
import { AuthRequest } from "../middlewares/authMiddleware";
import { z } from "zod";
import QRCode from "qrcode";
import { enforceFinancialAccess } from "../utils/accessGuard";
import {
  getMarketPriceForCoin,
  getPriceByCoinSymbol,
} from "../services/marketPriceService";
import { encryptAndMoveReceipt } from "../middlewares/receiptUpload";
import path from "path";
import { decryptFileToStream } from "../utils/crypto";

const createWalletSchema = z.object({
  coinId: z.string(),
  networkId: z.string().optional().nullable(),
  contractAddress: z.string().optional().nullable(),
});
const withdrawSchema = z.object({
  walletId: z.string(),
  amount: z.coerce.number().positive(),
  toAddress: z.string().min(1),
  // For dual-currency conversion during withdraw
  convertToId: z.string().optional(),
});
const bankWithdrawSchema = z.object({
  walletId: z.string().optional(), // bank withdraw may not need a crypto wallet
  amount: z.coerce.number().positive(),
  bankName: z.string().min(2),
  accountName: z.string().min(2),
  accountNumber: z.string().min(6),
  ifscCode: z.string().min(3),
});
const depositSchema = z.object({
  walletId: z.string(),
  amount: z.coerce.number().positive(),
  txHash: z.string().optional(),
  // For dual-currency deposits (e.g., deposit USDT to get BTC equivalent)
  fromCoinId: z.string().optional(),
  toCoinId: z.string().optional(),
  receiptUrl: z.string().optional(),
});

type WalletWithCoin = {
  id: string;
  userId: string;
  coinId: string;
  balance: number;
  address: string | null;
  coin: {
    id: string;
    symbol: string;
    name: string;
    iconUrl: string | null;
    isActive: boolean;
  };
};
export const getAssets = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const wallets = await prisma.wallet.findMany({
      where: { userId },
      include: {
        coin: true,
        network: true,
      },
      orderBy: [{ coin: { name: "asc" } }, { network: { name: "asc" } }],
    });

    const assets = await Promise.all(
      wallets.map(async (wallet) => {
        let qrCode = "";

        if (wallet.address) {
          try {
            qrCode = await QRCode.toDataURL(wallet.address);
          } catch (err) {
            console.error("QR Gen Error:", err);
          }
        }

        return {
          walletId: wallet.id,
          balance: wallet.balance,
          coin: {
            id: wallet.coin.id,
            name: wallet.coin.name,
            symbol: wallet.coin.symbol,
            iconUrl: wallet.coin.iconUrl,
          },

          network: wallet.network
            ? {
                id: wallet.network.id,
                name: wallet.network.name,
                icon: wallet.network.icon,
                type: wallet.network.type,
              }
            : null,

          address: wallet.address,
          qrCode,
          // createdAt: wallet.updatedAt,
        };
      }),
    );

    return res.json({
      success: true,
      count: assets.length,
      assets,
    });
  } catch (error) {
    console.error("getAssets error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch assets",
    });
  }
};

export const createWallet = async (req: AuthRequest, res: Response) => {
  try {
    const { coinId, networkId } = createWalletSchema.parse(req.body);
    const userId = req.user!.userId;

    if (!networkId) {
      return res.status(400).json({
        success: false,
        error: "Network is required to create a wallet",
      });
    }
    /* 1️⃣ Validate user + KYC */
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true, suspended: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, error: "User not found" });
    }

    if (user.suspended) {
      return res.status(403).json({
        success: false,
        error: "Account suspended",
      });
    }

    if (user.kycStatus !== "APPROVED") {
      return res.status(403).json({
        success: false,
        error: "KYC verification required",
        kycStatus: user.kycStatus,
      });
    }

    /* 2️⃣ Resolve CoinNetwork FIRST */
    const coinNetwork = await prisma.coinNetwork.findFirst({
      where: {
        coinId,
        networkId, // now guaranteed string
        isActive: true,
        contractAddress: { not: null },
      },
      include: { coin: true, network: true },
    });

    if (!coinNetwork) {
      return res.status(400).json({
        success: false,
        error: "No deposit address configured for this network",
      });
    }

    /* 3️⃣ Check wallet uniqueness (STRICT) */
    const existingWallet = await prisma.wallet.findUnique({
      where: {
        userId_coinId_networkId: {
          userId,
          coinId,
          networkId: coinNetwork.networkId,
        },
      },
      include: { coin: true, network: true },
    });

    if (existingWallet) {
      return res.json({
        success: true,
        message: "Wallet already exists",
        wallet: {
          ...existingWallet,
          qrCode: existingWallet.address
            ? await QRCode.toDataURL(existingWallet.address)
            : null,
          coinName: existingWallet.coin.name,
          coinSymbol: existingWallet.coin.symbol,
          networkName: existingWallet.network?.name ?? "N/A",
        },
      });
    }

    /* 4️⃣ Create wallet */
    const wallet = await prisma.wallet.create({
      data: {
        userId,
        coinId,
        networkId: coinNetwork.networkId,
        address: coinNetwork.contractAddress,
        balance: 0,
      },
      include: { coin: true, network: true },
    });

    /* 5️⃣ Generate QR */
    const qrCode = await QRCode.toDataURL(wallet.address!);

    return res.status(201).json({
      success: true,
      message: "Wallet created successfully",
      wallet: {
        ...wallet,
        qrCode,
        coinName: wallet.coin.name,
        coinSymbol: wallet.coin.symbol,
        networkName: wallet.network?.name ?? "N/A",
      },
    });
  } catch (error: any) {
    console.error("Create wallet error:", error);

    // ✅ Gracefully handle race condition
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        error: "Wallet already exists for this network",
      });
    }

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to create wallet",
    });
  }
};

export const getUserWallets = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    // Check user's KYC status
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { kycStatus: true },
    });

    if (user?.kycStatus !== "APPROVED") {
      return res.status(403).json({
        success: false,
        error: "KYC verification required",
        message: "Please complete KYC verification to view wallets",
        kycStatus: user?.kycStatus,
      });
    }

    const wallets = await prisma.wallet.findMany({
      where: { userId },
      include: {
        coin: true,
        network: true,
      },
      orderBy: { coin: { name: "asc" } },
    });

    // Generate QR codes
    const walletsWithQr = await Promise.all(
      wallets.map(async (wallet) => {
        const qrCode = wallet.address
          ? await QRCode.toDataURL(wallet.address)
          : null;
        return {
          ...wallet,
          qrCode,
          coinName: wallet.coin.name,
          coinSymbol: wallet.coin.symbol,
          networkName: wallet.network?.name,
        };
      }),
    );

    res.json({
      success: true,
      kycVerified: true,
      count: wallets.length,
      wallets: walletsWithQr,
    });
  } catch (error) {
    console.error("Get user wallets error:", error);
    res.status(500).json({
      error: "Failed to fetch wallets",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
// Get wallet by ID
export const getWalletById = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { id } = req.params;

    const wallet = await prisma.wallet.findFirst({
      where: {
        id,
        userId,
      },
      include: {
        coin: true,
        network: true,
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
      },
    });

    if (!wallet) {
      return res.status(404).json({
        error: "Wallet not found",
        details:
          "Wallet does not exist or you don't have permission to access it",
      });
    }

    const qrCode = wallet.address
      ? await QRCode.toDataURL(wallet.address)
      : null;

    res.json({
      success: true,
      wallet: {
        ...wallet,
        qrCode,
        coinName: wallet.coin.name,
        coinSymbol: wallet.coin.symbol,
        networkName: wallet.network?.name,
      },
    });
  } catch (error) {
    console.error("Get wallet by ID error:", error);
    res.status(500).json({
      error: "Failed to fetch wallet",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Update wallet balance
const updateWalletSchema = z.object({
  balance: z.number().min(0),
});

export const updateWalletBalance = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { balance } = updateWalletSchema.parse(req.body);

    // Check if user owns the wallet or is admin
    const userId = req.user!.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    const wallet = await prisma.wallet.findUnique({
      where: { id },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }

    // Only allow if user owns the wallet or is admin
    if (wallet.userId !== userId && user?.role !== "ADMIN") {
      return res.status(403).json({
        error: "Forbidden",
        details: "You don't have permission to update this wallet",
      });
    }

    const updatedWallet = await prisma.wallet.update({
      where: { id },
      data: { balance },
      include: {
        coin: true,
        network: true,
      },
    });

    res.json({
      success: true,
      message: "Wallet balance updated",
      wallet: updatedWallet,
    });
  } catch (error) {
    console.error("Update wallet balance error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    res.status(500).json({
      error: "Failed to update wallet balance",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// Get deposit address for a specific coin
export const getDepositAddress = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { coinId } = req.params;
    const { networkId, contractAddress } = req.query;

    // Find or create wallet for this coin
    const whereCondition: any = {
      userId,
      coinId,
    };

    if (networkId && typeof networkId === "string") {
      whereCondition.networkId = networkId;
    } else {
      whereCondition.networkId = null;
    }

    if (contractAddress && typeof contractAddress === "string") {
      whereCondition.contractAddress = contractAddress;
    } else {
      whereCondition.contractAddress = null;
    }

    let wallet = await prisma.wallet.findFirst({
      where: whereCondition,
      include: {
        coin: true,
        network: true,
      },
    });

    // If wallet doesn't exist, get the admin address
    if (!wallet) {
      const coinNetworkWhere: any = { coinId };

      if (networkId && typeof networkId === "string") {
        coinNetworkWhere.networkId = networkId;
      } else {
        coinNetworkWhere.networkId = null;
      }

      const coinNetwork = await prisma.coinNetwork.findFirst({
        where: coinNetworkWhere,
        include: {
          coin: true,
          network: true,
        },
      });

      if (!coinNetwork?.contractAddress) {
        return res.status(404).json({
          error: "No deposit address available",
          message: "This coin is not configured for deposits",
        });
      }

      // Return the address without creating a wallet
      const qrCode = await QRCode.toDataURL(coinNetwork.contractAddress);

      return res.json({
        success: true,
        address: coinNetwork.contractAddress,
        qrCode,
        coinName: coinNetwork.coin.name,
        coinSymbol: coinNetwork.coin.symbol,
        networkName: coinNetwork.network?.name,
        note: "Create a wallet to track your balance",
      });
    }

    // Wallet exists, return its address
    const qrCode = wallet.address
      ? await QRCode.toDataURL(wallet.address)
      : null;

    res.json({
      success: true,
      address: wallet.address,
      qrCode,
      coinName: wallet.coin.name,
      coinSymbol: wallet.coin.symbol,
      networkName: wallet.network?.name,
      walletId: wallet.id,
    });
  } catch (error) {
    console.error("Get deposit address error:", error);
    res.status(500).json({
      error: "Failed to get deposit address",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
export const requestDeposit = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    if (!(await enforceFinancialAccess(userId, res))) return;

    const { walletId, amount, txHash, fromCoinId, toCoinId, receiptUrl } =
      depositSchema.parse(req.body);

    const file = req.file;
    let finalReceiptUrl = receiptUrl;

    if (file) {
      finalReceiptUrl = encryptAndMoveReceipt(userId, file);
    }
console.log(userId, finalReceiptUrl)
    // Verify wallet belongs to user
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId } });
    if (!wallet || wallet.userId !== userId)
      return res.status(403).json({ error: "Unauthorized" });

    // Get wallet coin details
    const walletCoin = await prisma.coin.findUnique({
      where: { id: wallet.coinId },
    });

    if (!walletCoin) {
      return res.status(400).json({ error: "Wallet coin not found" });
    }

    // Handle conversion/deposit data
    let transactionData: any = {
      userId,
      walletId,
      type: "DEPOSIT",
      amount,
      txHash: txHash || `mock_tx_${Date.now()}`,
      status: "PENDING",
      fromCoinId: fromCoinId || wallet.coinId,
      fromAmount: amount,
      receiptUrl: finalReceiptUrl,
    };

    // 💡 DETERMINING IF THIS IS A CONVERSION DEPOSIT
    // It's a conversion if fromCoinId is provided AND it's different from the wallet's target coin
    const isConversion = Boolean(fromCoinId && fromCoinId !== wallet.coinId);

    if (isConversion) {
      const fromCoin = await prisma.coin.findUnique({
        where: { id: fromCoinId },
      });
      const toCoin = await prisma.coin.findUnique({
        where: { id: wallet.coinId },
      });

      if (!fromCoin || !toCoin) {
        return res
          .status(400)
          .json({ error: "Invalid coin IDs for conversion" });
      }

      // Get conversion rate
      const fromPrice = await getPriceByCoinSymbol(fromCoin.symbol);
      const toPrice = await getPriceByCoinSymbol(toCoin.symbol);

      if (!fromPrice || !toPrice) {
        return res
          .status(400)
          .json({ error: "Market prices not available for conversion" });
      }

      const conversionRate = fromPrice / toPrice;
      const convertedAmount = amount * conversionRate;

      transactionData = {
        ...transactionData,
        toCoinId: wallet.coinId,
        toAmount: convertedAmount,
        conversionRate,
      };

      // 🛑 BALANCE INCREMENT REMOVED - Wait for admin approval
    } else {
      // Standard deposit - no conversion needed
      // 🛑 BALANCE INCREMENT REMOVED - Wait for admin approval
    }

    // Create Transaction
    const tx = await prisma.transaction.create({
      data: transactionData,
    });

    res.json({
      success: true,
      message: "Deposit request created successfully",
      transaction: tx,
    });
  } catch (error) {
    console.error("Deposit error:", {
      message: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
    });

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    return res.status(400).json({ error: "Deposit request failed" });
  }
};

export const requestWithdraw = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    if (!(await enforceFinancialAccess(userId, res))) return;

    const { walletId, amount, toAddress, convertToId } = withdrawSchema.parse(
      req.body,
    );

    const wallet = await prisma.wallet.findUnique({
      where: { id: walletId },
      include: { coin: true },
    });

    if (!wallet || wallet.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized wallet access" });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    let transactionData: any = {
      userId,
      walletId,
      type: "WITHDRAW",
      amount,
      toAddress,
      status: "PENDING",
      fromCoinId: wallet.coinId,
      fromAmount: amount,
    };

    // Handle conversion during withdrawal
    if (convertToId && convertToId !== wallet.coinId) {
      const convertToCoin = await prisma.coin.findUnique({
        where: { id: convertToId },
      });

      if (!convertToCoin) {
        return res.status(400).json({ error: "Invalid conversion coin ID" });
      }

      // Get conversion rate
      const fromPrice = await getPriceByCoinSymbol(wallet.coin.symbol);
      const toPrice = await getPriceByCoinSymbol(convertToCoin.symbol);

      if (!fromPrice || !toPrice) {
        return res.status(400).json({ error: "Market prices not available" });
      }

      const conversionRate = fromPrice / toPrice;
      const convertedAmount = amount * conversionRate;

      transactionData = {
        ...transactionData,
        toCoinId: convertToId,
        toAmount: convertedAmount,
        conversionRate,
      };
    }

    // Lock funds (debit user from the wallet)
    // 🛑 DEBIT REMOVED - Wait for admin approval
    /*
    await prisma.wallet.update({
      where: { id: walletId },
      data: { balance: { decrement: amount } },
    });
    */

    // Create Transaction
    const tx = await prisma.transaction.create({
      data: transactionData,
    });

    res.json({
      success: true,
      message: "Withdraw request submitted",
      transaction: tx,
    });
  } catch (error) {
    console.error("Withdraw error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }
    res.status(400).json({ error: "Withdraw request failed" });
  }
};

export const requestBankWithdraw = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    if (!(await enforceFinancialAccess(userId, res))) return;

    const { walletId, amount, bankName, accountName, accountNumber, ifscCode } =
      bankWithdrawSchema.parse(req.body);

    // BANK withdraw must still deduct from a user's wallet balance.
    const wallet = await prisma.wallet.findUnique({ where: { id: walletId! } });

    if (!wallet || wallet.userId !== userId) {
      return res.status(403).json({ error: "Unauthorized wallet access" });
    }

    if (wallet.balance < amount) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Debit funds
    // 🛑 DEBIT REMOVED - Wait for admin approval
    /*
    await prisma.wallet.update({
      where: { id: walletId! },
      data: { balance: { decrement: amount } },
    });
    */

    const tx = await prisma.transaction.create({
      data: {
        userId,
        walletId,
        type: "BANK_WITHDRAW",
        amount,
        status: "PENDING",
        bankName,
        accountName,
        accountNumber,
        ifscCode,
      },
    });

    return res.json({
      success: true,
      message: "Bank withdrawal request submitted",
      transaction: tx,
    });
  } catch (error) {
    console.error("Bank withdraw error:", error);
    return res.status(400).json({
      error: "Bank withdrawal request failed",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getTransactions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const transactions = await prisma.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: { wallet: { include: { coin: true } } },
    });
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Failed" });
  }
};

export const getWalletConversions = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const fromCoinParam = (req.query.coinId || req.query.coin) as
      | string
      | undefined;
    const toCoinParam = (req.query.toCoinId || req.query.to) as
      | string
      | undefined;
    const amountParam = req.query.amount ? Number(req.query.amount) : undefined;

    // 💡 PORTFOLIO MODE: If no specific conversion is requested, return value of all wallets in USDT (or target)
    if (!fromCoinParam || !toCoinParam || amountParam === undefined) {
      const targetSymbol = (toCoinParam || "USDT").toUpperCase();
      const targetCoin = await prisma.coin.findFirst({
        where: {
          OR: [{ id: toCoinParam || "" }, { symbol: targetSymbol }],
        },
      });

      const wallets = await prisma.wallet.findMany({
        where: { userId },
        include: { coin: true },
      });

      const targetPrice = await getPriceByCoinSymbol(targetSymbol);

      const results = await Promise.all(
        wallets.map(async (w) => {
          const currentPrice = await getPriceByCoinSymbol(w.coin.symbol);
          const value = (w.balance * (currentPrice || 0)) / (targetPrice || 1);
          return {
            walletId: w.id,
            coin: w.coin.symbol,
            balance: w.balance,
            price: currentPrice,
            value: value,
            convertedTo: targetSymbol,
          };
        }),
      );

      const totalValue = results.reduce((sum, w) => sum + w.value, 0);

      return res.json({
        success: true,
        mode: "portfolio",
        base: targetSymbol,
        totalValue,
        wallets: results,
      });
    }

    if (amountParam <= 0) {
      return res.status(400).json({
        success: false,
        error: "Amount must be greater than zero",
      });
    }

    /* 1️⃣ Validate coins (support ID or Symbol) */
    const [fromCoin, toCoin] = await Promise.all([
      prisma.coin.findFirst({
        where: {
          OR: [
            { id: fromCoinParam.length === 36 ? fromCoinParam : undefined },
            { symbol: fromCoinParam.toUpperCase() },
          ],
        },
      }),
      prisma.coin.findFirst({
        where: {
          OR: [
            { id: toCoinParam.length === 36 ? toCoinParam : undefined },
            { symbol: toCoinParam.toUpperCase() },
          ],
        },
      }),
    ]);

    if (!fromCoin || !toCoin || !fromCoin.isActive || !toCoin.isActive) {
      return res.status(404).json({
        success: false,
        error: "One or both coins not supported",
      });
    }

    if (fromCoin.id === toCoin.id) {
      return res.status(400).json({
        success: false,
        error: "Cannot convert to the same wallet",
      });
    }

    /* 2️⃣ Check source wallet */
    const fromWallet = await prisma.wallet.findFirst({
      where: { userId, coinId: fromCoin.id },
    });

    if (!fromWallet || fromWallet.balance < amountParam) {
      return res.status(400).json({
        success: false,
        error: `Insufficient ${fromCoin.symbol} balance`,
      });
    }

    /* 3️⃣ Check target wallet */
    const toWallet = await prisma.wallet.findFirst({
      where: { userId, coinId: toCoin.id },
    });

    if (!toWallet) {
      return res.status(400).json({
        success: false,
        error: `Target wallet for ${toCoin.symbol} not found`,
      });
    }

    /* 4️⃣ Get Market Rates */
    const fromPrice = await getPriceByCoinSymbol(fromCoin.symbol);
    const toPrice = await getPriceByCoinSymbol(toCoin.symbol);

    // if (!fromPrice || !toPrice) {
    //   return res.status(400).json({
    //     success: false,
    //     error: "Market prices not available for conversion",
    //   });
    // }

    // const conversionRate = fromPrice / toPrice;
    // const convertedAmount = amountParam * conversionRate;

    return res.json({
      success: true,
      mode: "single",
      from: fromCoin.symbol,
      to: toCoin.symbol,
      amount: amountParam,
      // conversionRate,
      // convertedAmount,
    });
  } catch (error) {
    console.error("Conversion preview error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to preview conversion",
    });
  }
};

export const executeConversion = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const { fromCoinId, toCoinId, amount } = z
      .object({
        fromCoinId: z.string().uuid(),
        toCoinId: z.string().uuid(),
        amount: z.coerce.number().positive(),
      })
      .parse(req.body);

    if (fromCoinId === toCoinId) {
      return res.status(400).json({
        success: false,
        error: "Cannot move funds to the same wallet",
      });
    }

    /* 1️⃣ Fetch coins (validation only) */
    const [fromCoin, toCoin] = await Promise.all([
      prisma.coin.findUnique({
        where: { id: fromCoinId },
      }),
      prisma.coin.findUnique({
        where: { id: toCoinId },
      }),
    ]);

    if (!fromCoin || !toCoin || !fromCoin.isActive || !toCoin.isActive) {
      return res.status(404).json({
        success: false,
        error: "One or both coins are not supported",
      });
    }

    /* 2️⃣ Fetch wallets */
    const [fromWallet, toWallet] = await Promise.all([
      prisma.wallet.findFirst({
        where: { userId, coinId: fromCoinId },
      }),
      prisma.wallet.findFirst({
        where: { userId, coinId: toCoinId },
      }),
    ]);

    if (!fromWallet || fromWallet.balance < amount) {
      return res.status(400).json({
        success: false,
        error: `Insufficient ${fromCoin.symbol} balance`,
      });
    }

    if (!toWallet) {
      return res.status(400).json({
        success: false,
        error: `Target wallet for ${toCoin.symbol} not found`,
      });
    }

    /* 3️⃣ Get Market Rates & Calculate Payout */
    const fromPrice = await getPriceByCoinSymbol(fromCoin.symbol);
    const toPrice = await getPriceByCoinSymbol(toCoin.symbol);

    if (!fromPrice || !toPrice) {
      return res.status(400).json({
        success: false,
        error: "Market prices not available for conversion execution",
      });
    }

    const conversionRate = fromPrice / toPrice;
    const convertedAmount = amount * conversionRate;

    /* 4️⃣ Atomic internal transfer */
    const transaction = await prisma.$transaction(async (tx) => {
      await tx.wallet.update({
        where: { id: fromWallet.id },
        data: {
          balance: { decrement: amount },
        },
      });

      await tx.wallet.update({
        where: { id: toWallet.id },
        data: {
          balance: { increment: amount },
        },
      });

      return tx.transaction.create({
        data: {
          userId,
          walletId: fromWallet.id,
          type: "TRANSFER",
          status: "COMPLETED",

          // REQUIRED BY SCHEMA
          amount,

          // AUDIT FIELDS
          fromCoinId,
          toCoinId,
          fromAmount: amount,
          toAmount: convertedAmount,
          conversionRate,

          txHash: `conv_${Date.now()}`,
        },
      });
    });

    return res.json({
      success: true,
      message: "Funds moved successfully",
      transaction,
    });
  } catch (err) {
    console.error("executeConversion error:", err);

    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: err.errors,
      });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to move funds",
    });
  }
};

export const getDepositImage = async (
  req: AuthRequest,
  res: Response
) => {
    const { userId, filename } = req.params;
console.log(userId, filename)
 const isAdmin = req.user?.role === "ADMIN";
  const isOwner = req.user?.userId === userId;

  if (!isAdmin && !isOwner) {
    return res.status(403).json({ error: "Forbidden" });
  }
  const filePath = path.join(
    process.cwd(),
    "private_uploads",
    "receipts",
    userId,
    filename
  );
console.log(filePath)
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File not found" });
  }

  res.setHeader("Content-Type", "image/webp");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");

  decryptFileToStream(filePath, res);
};