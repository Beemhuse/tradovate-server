import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { AuthRequest } from "../middlewares/authMiddleware";
import { z, ZodError } from "zod";
import { fetchPrices } from "../services/marketPriceService";
import { sendAdminTradeMail } from "../utils/sendAdminTradeEmail";

export const placeOrderSchema = z.object({
  marketPairId: z.string().uuid(),
  period: z.enum(["S30", "M1", "M5", "M15"]),
  direction: z.enum(["BULLISH", "BEARISH"]),
  stake: z.number().positive(),
  entryPrice: z.number().positive(),
});

export const TRADE_PERIODS = {
  S30: { seconds: 30, profitRate: 0.8 },
  M1: { seconds: 60, profitRate: 0.9 },
  M5: { seconds: 300, profitRate: 1.2 },
  M15: { seconds: 900, profitRate: 1.5 },
} as const;

export const placeTradeSchema = z.object({
  tradeConfigId: z.string().uuid(),
  stake: z.number().positive(),
  entryPrice: z.number().positive(),
});

export const getMarketPrices = async (req: Request, res: Response) => {
  try {
    const prices = await fetchPrices();
    res.json(prices);
  } catch (error) {
    console.error("getMarketPrices error:", error);
    res.status(500).json({ error: "Failed to fetch market prices" });
  }
};

export const placeOrder = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const userId = req.user.userId;
    const { marketPairId, period, direction, stake, entryPrice } =
      placeOrderSchema.parse(req.body);

    /* ============================
       Load trade config + pair
    ============================ */
    // Find the config for this Pair + Period
    const tradeConfig = await prisma.tradeConfig.findUnique({
      where: {
        marketPairId_period: {
          marketPairId,
          period,
        },
      },
      include: {
        marketPair: {
          include: {
            quoteCoin: true,
            network: true,
          },
        },
      },
    });

    if (!tradeConfig || !tradeConfig.isActive) {
      return res
        .status(400)
        .json({ error: "Invalid trade configuration or period not supported" });
    }

    const pair = tradeConfig.marketPair;

    if (!pair.isActive) {
      return res.status(400).json({ error: "Trading pair is inactive" });
    }

    if (pair.quoteCoin.symbol !== "USDT") {
      return res.status(400).json({
        error: "Trades can only be settled using USDT",
      });
    }

    /* ============================
       Stake validation
    ============================ */
    if (
      stake < Number(tradeConfig.minStake) ||
      stake > Number(tradeConfig.maxStake)
    ) {
      return res.status(400).json({
        error: `Stake must be between ${tradeConfig.minStake} and ${tradeConfig.maxStake}`,
      });
    }

    /* ============================
       Expiry calculation
    ============================ */
    const PERIOD_SECONDS: Record<string, number> = {
      S30: 30,
      M1: 60,
      M5: 300,
      M15: 900,
    };

    const seconds = PERIOD_SECONDS[tradeConfig.period];
    if (!seconds) {
      return res.status(400).json({ error: "Invalid trade period" });
    }

    const expiresAt = new Date(Date.now() + seconds * 1000);

    /* ============================
       Atomic transaction
    ============================ */
    const order = await prisma.$transaction(async (tx) => {
      const usdtWallets = await tx.wallet.findMany({
        where: {
          userId,
          coin: { symbol: "USDT" },
          networkId: pair.networkId,
        },
        orderBy: { balance: "desc" },
      });

      if (!usdtWallets.length) {
        throw new Error("USDT_WALLET_NOT_FOUND");
      }

      const totalBalance = usdtWallets.reduce(
        (sum, w) => sum + Number(w.balance),
        0,
      );

      if (totalBalance < stake) {
        throw new Error("INSUFFICIENT_USDT");
      }

      let remaining = stake;

      for (const wallet of usdtWallets) {
        if (remaining <= 0) break;

        const deduct = Math.min(Number(wallet.balance), remaining);

        if (deduct > 0) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { decrement: deduct } },
          });

          remaining -= deduct;
        }
      }

      return tx.order.create({
        data: {
          userId,
          marketPairId: pair.id,
          tradeConfigId: tradeConfig.id,
          direction, // 👈 Manual direction
          stake,
          entryPrice,
          profitRate: tradeConfig.profitRate,
          expiresAt,
          status: "PENDING",
        },
      });
    });
    /* 🔥 RE-FETCH WITH HUMAN DATA */
    const fullOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
        marketPair: {
          include: {
            baseCoin: { select: { symbol: true } },
            quoteCoin: { select: { symbol: true } },
            network: { select: { name: true } },
          },
        },
        tradeConfig: {
          select: {
            period: true,
            profitRate: true,
          },
        },
      },
    });

    await sendAdminTradeMail(fullOrder!, seconds).catch(console.error);
    return res.json({ success: true, order });
  } catch (err: any) {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: err.errors });
    }

    if (err.message === "USDT_WALLET_NOT_FOUND") {
      return res.status(400).json({ error: "USDT wallet not found" });
    }

    if (err.message === "INSUFFICIENT_USDT") {
      return res.status(400).json({ error: "Insufficient USDT balance" });
    }

    console.error("placeOrder error:", err);
    return res.status(500).json({ error: "Trade placement failed" });
  }
};

export const getUserOrders = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const orders = await prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        marketPair: {
          include: {
            baseCoin: true,
            quoteCoin: true,
          },
        },
        tradeConfig: true,
      },
    });

    res.json(orders);
  } catch (error) {
    console.error("getUserOrders error:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

/* =========================================
   ADMIN: GET ALL ORDERS
========================================= */
export const adminGetOrders = async (req: Request, res: Response) => {
  try {
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: { id: true, email: true, fullName: true },
          },
          marketPair: {
            include: {
              baseCoin: true,
              quoteCoin: true,
            },
          },
        },
      }),
      prisma.order.count(),
    ]);
    // 🔔 Emit event (non-blocking)

    return res.json({
      orders,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("adminGetOrders error:", error);
    return res.status(500).json({ error: "Failed to fetch orders" });
  }
};

/* =========================================
   ADMIN: SETTLE ORDER (MANUAL)
========================================= */
export const adminSettleOrder = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { result } = req.body; // "WIN" or "LOSS"

    if (!["WIN", "LOSS"].includes(result)) {
      return res
        .status(400)
        .json({ error: "Invalid result. Must be WIN or LOSS" });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        marketPair: true, // Need to know networkId
        tradeConfig: true,
      },
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "PENDING") {
      return res.status(400).json({ error: "Order is already settled" });
    }

    await prisma.$transaction(async (tx) => {
      // 1. If WIN, Credit User logic
      if (result === "WIN") {
        const profit = Number(order.stake) * Number(order.profitRate);
        const payout = Number(order.stake) + profit;

        // Find user's USDT wallet on that network
        const wallet = await tx.wallet.findFirst({
          where: {
            userId: order.userId,
            coin: { symbol: "USDT" },
            networkId: order.marketPair.networkId,
          },
        });

        if (wallet) {
          // Update Wallet
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: { increment: payout } },
          });

          // Create Transaction Record
          await tx.transaction.create({
            data: {
              userId: order.userId,
              walletId: wallet.id,
              type: "DEPOSIT",
              amount: payout,
              status: "COMPLETED",
            },
          });
        }
      }

      // 2. Update Order Status
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: "SETTLED",
          result: result as "WIN" | "LOSS",
          settledAt: new Date(),
        },
      });
    });

    return res.json({ message: "Order settled successfully" });
  } catch (error) {
    console.error("adminSettleOrder error:", error);
    return res.status(500).json({ error: "Failed to settle order" });
  }
};
