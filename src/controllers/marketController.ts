import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../utils/prisma";
import { z } from "zod";
import { AuthRequest } from "../middlewares/authMiddleware";

const createPairSchema = z.object({
  baseCoinNetworkId: z.string().uuid(),
  quoteCoinNetworkId: z.string().uuid(),
  minStake: z.number().positive(),
  maxStake: z.number().positive(),
  isActive: z.boolean().optional(),
});

const updatePairSchema = z.object({
  isActive: z.boolean().optional(),
});
export const createPair = async (req: Request, res: Response) => {
  try {
    const {
      baseCoinNetworkId,
      quoteCoinNetworkId,
      minStake,
      maxStake,
      isActive,
    } = createPairSchema.parse(req.body);

    if (minStake >= maxStake) {
      return res.status(400).json({
        error: "minStake must be less than maxStake",
      });
    }

    const [base, quote] = await Promise.all([
      prisma.coinNetwork.findUnique({
        where: { id: baseCoinNetworkId },
        include: { coin: true },
      }),
      prisma.coinNetwork.findUnique({
        where: { id: quoteCoinNetworkId },
        include: { coin: true },
      }),
    ]);

    if (!base || !base.isActive) {
      return res.status(400).json({ error: "Invalid base coin" });
    }

    if (!quote || !quote.isActive) {
      return res.status(400).json({ error: "Invalid quote coin" });
    }

    if (base.networkId !== quote.networkId) {
      return res.status(400).json({
        error: "Base and quote must be on the same network",
      });
    }

    if (base.coinId === quote.coinId) {
      return res.status(400).json({
        error: "Base and quote cannot be the same asset",
      });
    }

    if (quote.coin.symbol !== "USDT") {
      return res.status(400).json({
        error: "Only USDT is allowed as quote currency",
      });
    }

    if (base.coin.symbol === "USDT") {
      return res.status(400).json({
        error: "USDT cannot be used as base currency",
      });
    }

    const symbol = `${base.coin.symbol}/${quote.coin.symbol}`;
    const wsSymbol = `${base.coin.symbol}${quote.coin.symbol}`.toLowerCase();

    // Default periods setup
    const periods = [
      { period: "S30", profitRate: 0.8 },
      { period: "M1", profitRate: 0.9 },
      { period: "M5", profitRate: 1.2 },
      { period: "M15", profitRate: 1.5 },
    ] as const;

    const result = await prisma.$transaction(async (tx) => {
      let pair = await tx.marketPair.findUnique({
        where: {
          baseCoinId_quoteCoinId_networkId: {
            baseCoinId: base.coinId,
            quoteCoinId: quote.coinId,
            networkId: base.networkId,
          },
        },
      });

      if (!pair) {
        pair = await tx.marketPair.create({
          data: {
            baseCoinId: base.coinId,
            quoteCoinId: quote.coinId,
            networkId: base.networkId,
            symbol,
            wsSymbol,
            isActive: true,
          },
        });
      } else if (!pair.isActive) {
        pair = await tx.marketPair.update({
          where: { id: pair.id },
          data: { isActive: true },
        });
      }

      // Create Configs for ALL periods
      const createdConfigs = [];
      for (const p of periods) {
        const existingConfig = await tx.tradeConfig.findUnique({
          where: {
            marketPairId_period: {
              marketPairId: pair.id,
              period: p.period,
            },
          },
        });

        if (!existingConfig) {
          const config = await tx.tradeConfig.create({
            data: {
              marketPairId: pair.id,
              period: p.period,
              minStake,
              maxStake,
              profitRate: p.profitRate, // Use default rates
              isActive: isActive ?? true,
            },
          });
          createdConfigs.push(config);
        }
      }

      return { pair, configs: createdConfigs };
    });

    return res.status(201).json({
      success: true,
      pair: result.pair,
      configs: result.configs,
      message: "Trading pair and configs created successfully",
    });
  } catch (err: any) {
    console.error("createPair error:", err);

    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }

    return res.status(500).json({
      error: "Failed to create trading pair",
    });
  }
};

export const updatePair = async (req: Request, res: Response) => {
  try {
    const pairId = req.params.id;
    const { isActive } = updatePairSchema.parse(req.body);

    // 1️⃣ Ensure pair exists
    const pair = await prisma.marketPair.findUnique({
      where: { id: pairId },
    });

    if (!pair) {
      return res.status(404).json({
        success: false,
        error: "Trading pair not found",
      });
    }

    // 2️⃣ Update pair
    const updatedPair = await prisma.marketPair.update({
      where: { id: pairId },
      data: {
        isActive: isActive ?? pair.isActive,
      },
      include: {
        baseCoin: {
          select: { id: true, symbol: true, name: true, iconUrl: true },
        },
        quoteCoin: {
          select: { id: true, symbol: true, name: true, iconUrl: true },
        },
      },
    });

    return res.json({
      success: true,
      pair: updatedPair,
    });
  } catch (err: any) {
    console.error("updatePair error", err);

    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }

    return res.status(500).json({
      success: false,
      error: "Failed to update trading pair",
    });
  }
};

export const getPairs = async (req: Request, res: Response) => {
  try {
    const pairs = await prisma.marketPair.findMany({
      where: { isActive: true },
      select: {
        id: true,
        symbol: true,
        networkId: true, // ✅ added
        network: {
          select: { id: true, name: true, type: true, icon: true },
        },
        baseCoin: {
          select: { id: true, symbol: true, name: true, iconUrl: true },
        },
        quoteCoin: {
          select: { id: true, symbol: true, name: true, iconUrl: true },
        },
      },
      orderBy: { symbol: "asc" },
    });

    res.json({
      success: true,
      pairs,
    });
  } catch (err) {
    console.error("getPairs error", err);
    res.status(500).json({ error: "Failed to fetch pairs" });
  }
};

export const adminGetPairs = async (req: Request, res: Response) => {
  try {
    const pairs = await prisma.marketPair.findMany({
      include: {
        network: {
          select: {
            id: true,
            name: true,
            slug: true,
            type: true,
            icon: true,
            isActive: true,
          },
        },
        baseCoin: {
          select: { id: true, symbol: true, name: true, iconUrl: true },
        },
        quoteCoin: {
          select: { id: true, symbol: true, name: true, iconUrl: true },
        },
      },
      orderBy: { symbol: "asc" },
    });

    res.json({
      success: true,
      pairs,
    });
  } catch (err) {
    console.error("adminGetPairs error", err);
    res.status(500).json({ error: "Failed to fetch pairs" });
  }
};

export const getPairById = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    /* ===========================
       Fetch market pair + configs
    ============================ */
    const pair = await prisma.marketPair.findUnique({
      where: { id },
      include: {
        network: {
          select: { id: true, name: true, type: true, icon: true },
        },
        baseCoin: {
          select: { id: true, symbol: true, name: true, iconUrl: true },
        },
        quoteCoin: {
          select: { id: true, symbol: true, name: true, iconUrl: true },
        },
        tradeConfigs: {
          where: { isActive: true },
          orderBy: { period: "asc" },
          select: {
            id: true,
            period: true,
            // direction: true,
            minStake: true,
            maxStake: true,
            profitRate: true,
            isActive: true,
          },
        },
      },
    });

    if (!pair || !pair.isActive) {
      return res.status(404).json({
        success: false,
        error: "Market pair not found or inactive",
      });
    }

    /* ===========================
       Guest user
    ============================ */
    if (!userId) {
      return res.json({
        success: true,
        pair,
        wallet: {
          exists: false,
          balance: 0,
        },
      });
    }

    /* ===========================
       Fetch USDT wallet (same network)
    ============================ */
    const usdtWallet = await prisma.wallet.findFirst({
      where: {
        userId,
        coin: { symbol: "USDT" },
        networkId: pair.networkId,
      },
      select: {
        id: true,
        balance: true,
      },
    });

    return res.json({
      success: true,
      pair,
      wallet: {
        exists: Boolean(usdtWallet),
        walletId: usdtWallet?.id ?? null,
        balance: usdtWallet?.balance ?? 0,
      },
    });
  } catch (err) {
    console.error("getPairById error", err);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch market pair",
    });
  }
};

// Admin: Create a TradeConfig (trade period) for a market pair
const createConfigSchema = z.object({
  marketPairId: z.string().uuid(),
  period: z.string(),
  minStake: z.number().positive(),
  maxStake: z.number().positive(),
  profitRate: z.number().positive(),
  isActive: z.boolean().optional(),
});

export const createTradeConfig = async (req: Request, res: Response) => {
  try {
    const payload = createConfigSchema.parse(req.body);

    if (payload.minStake >= payload.maxStake) {
      return res.status(400).json({ error: "minStake must be less than maxStake" });
    }

    const pair = await prisma.marketPair.findUnique({ where: { id: payload.marketPairId } });
    if (!pair) {
      return res.status(404).json({ error: "Market pair not found" });
    }

    // Ensure unique period per pair
    const existing = await prisma.tradeConfig.findUnique({
      where: { marketPairId_period: { marketPairId: payload.marketPairId, period: payload.period as any } },
    });

    if (existing) {
      return res.status(400).json({ error: "Trade config for this period already exists for the pair" });
    }

    // Validate period against known enum values to avoid DB errors
    const allowedPeriods = ["S30", "M1", "M5", "M15"];
    if (!allowedPeriods.includes(payload.period)) {
      return res.status(400).json({ error: "Invalid period value" });
    }

    // Prisma's Decimal fields may require string/Prisma.Decimal inputs depending on client config.
    // Convert numeric inputs to string to be safe.
    const config = await prisma.tradeConfig.create({
      data: {
        marketPairId: payload.marketPairId,
        period: payload.period as any,
        minStake: payload.minStake.toString() as any,
        maxStake: payload.maxStake.toString() as any,
        profitRate: payload.profitRate.toString() as any,
        isActive: payload.isActive ?? true,
      },
    });

    return res.status(201).json({ success: true, config });
  } catch (err: any) {
    console.error("createTradeConfig error", err);
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: "Failed to create trade config" });
  }
};

// Admin: Update a TradeConfig
const updateConfigSchema = z.object({
  minStake: z.number().positive().optional(),
  maxStake: z.number().positive().optional(),
  profitRate: z.number().positive().optional(),
  isActive: z.boolean().optional(),
});

export const updateTradeConfig = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const payload = updateConfigSchema.parse(req.body);

    const config = await prisma.tradeConfig.findUnique({ where: { id } });
    if (!config) return res.status(404).json({ error: "Trade config not found" });

    if (payload.minStake !== undefined && payload.maxStake !== undefined) {
      if (payload.minStake >= payload.maxStake) {
        return res.status(400).json({ error: "minStake must be less than maxStake" });
      }
    }

    // Convert numeric fields to strings for Prisma Decimal compatibility
    const data: any = {};
    if (payload.minStake !== undefined) data.minStake = payload.minStake.toString();
    if (payload.maxStake !== undefined) data.maxStake = payload.maxStake.toString();
    if (payload.profitRate !== undefined) data.profitRate = payload.profitRate.toString();
    if (payload.isActive !== undefined) data.isActive = payload.isActive;

    const updated = await prisma.tradeConfig.update({ where: { id }, data });

    return res.json({ success: true, config: updated });
  } catch (err: any) {
    console.error("updateTradeConfig error", err);
    if (err instanceof z.ZodError) return res.status(400).json({ error: err.errors });
    return res.status(500).json({ error: "Failed to update trade config" });
  }
};

// Admin: Delete a TradeConfig
export const deleteTradeConfig = async (req: Request, res: Response) => {
  try {
    const id = req.params.id;
    const config = await prisma.tradeConfig.findUnique({ where: { id } });
    if (!config) return res.status(404).json({ error: "Trade config not found" });

    await prisma.tradeConfig.delete({ where: { id } });

    return res.json({ success: true, message: "Trade config deleted" });
  } catch (err: any) {
    console.error("deleteTradeConfig error", err);
    return res.status(500).json({ error: "Failed to delete trade config" });
  }
};
export const deletePair = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    // 1️⃣ Check if pair exists
    const pair = await prisma.marketPair.findUnique({
      where: { id },
    });

    if (!pair) {
      return res.status(404).json({
        success: false,
        error: "Market pair not found",
      });
    }

    // 2️⃣ Delete associated TradeConfigs and then the Pair
    // We do this in a transaction to be safe
    await prisma.$transaction([
      prisma.tradeConfig.deleteMany({
        where: { marketPairId: id },
      }),
      prisma.marketPair.delete({
        where: { id },
      }),
    ]);

    return res.json({
      success: true,
      message: "Market pair and associated configs deleted successfully",
    });
  } catch (err: any) {
    console.error("deletePair error:", err);
    return res.status(500).json({
      success: false,
      error: "Failed to delete market pair",
      details: err.message,
    });
  }
};
