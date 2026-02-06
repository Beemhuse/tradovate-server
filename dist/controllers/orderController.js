"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminSettleOrder = exports.adminGetOrders = exports.getUserOrders = exports.placeOrder = exports.getMarketPrices = exports.placeTradeSchema = exports.TRADE_PERIODS = exports.placeOrderSchema = void 0;
const prisma_1 = require("../utils/prisma");
const zod_1 = require("zod");
const marketPriceService_1 = require("../services/marketPriceService");
exports.placeOrderSchema = zod_1.z.object({
    marketPairId: zod_1.z.string().uuid(),
    period: zod_1.z.enum(["S30", "M1", "M5", "M15"]),
    direction: zod_1.z.enum(["BULLISH", "BEARISH"]),
    stake: zod_1.z.number().positive(),
    entryPrice: zod_1.z.number().positive(),
});
exports.TRADE_PERIODS = {
    S30: { seconds: 30, profitRate: 0.8 },
    M1: { seconds: 60, profitRate: 0.9 },
    M5: { seconds: 300, profitRate: 1.2 },
    M15: { seconds: 900, profitRate: 1.5 },
};
exports.placeTradeSchema = zod_1.z.object({
    tradeConfigId: zod_1.z.string().uuid(),
    stake: zod_1.z.number().positive(),
    entryPrice: zod_1.z.number().positive(),
});
const getMarketPrices = async (req, res) => {
    try {
        const prices = await (0, marketPriceService_1.fetchPrices)();
        res.json(prices);
    }
    catch (error) {
        console.error("getMarketPrices error:", error);
        res.status(500).json({ error: "Failed to fetch market prices" });
    }
};
exports.getMarketPrices = getMarketPrices;
const placeOrder = async (req, res) => {
    try {
        if (!req.user?.userId) {
            return res.status(401).json({ error: "Unauthorized" });
        }
        const userId = req.user.userId;
        const { marketPairId, period, direction, stake, entryPrice } = exports.placeOrderSchema.parse(req.body);
        /* ============================
           Load trade config + pair
        ============================ */
        // Find the config for this Pair + Period
        const tradeConfig = await prisma_1.prisma.tradeConfig.findUnique({
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
        if (stake < Number(tradeConfig.minStake) ||
            stake > Number(tradeConfig.maxStake)) {
            return res.status(400).json({
                error: `Stake must be between ${tradeConfig.minStake} and ${tradeConfig.maxStake}`,
            });
        }
        /* ============================
           Expiry calculation
        ============================ */
        const PERIOD_SECONDS = {
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
        const order = await prisma_1.prisma.$transaction(async (tx) => {
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
            const totalBalance = usdtWallets.reduce((sum, w) => sum + Number(w.balance), 0);
            if (totalBalance < stake) {
                throw new Error("INSUFFICIENT_USDT");
            }
            let remaining = stake;
            for (const wallet of usdtWallets) {
                if (remaining <= 0)
                    break;
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
        return res.json({ success: true, order });
    }
    catch (err) {
        if (err instanceof zod_1.ZodError) {
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
exports.placeOrder = placeOrder;
// const settleTrade = async (orderId: string) => {
//   const order = await prisma.order.findUnique({
//     where: { id: orderId },
//   });
//   if (!order || order.status !== "PENDING") return;
//   const market = await getMarketPriceForCoin(order.coinId);
//   const exitPrice = market.price;
//   const won =
//     order.direction === "BULLISH"
//       ? exitPrice > order.entryPrice
//       : exitPrice < order.entryPrice;
//   await prisma.$transaction(async (tx) => {
//     if (won) {
//       const payout = order.stake * (1 + order.profitRate);
//       await tx.wallet.update({
//         where: {
//           userId_coinId_networkId: {
//             userId: order.userId,
//             coinId: USDT_ID,
//             networkId: order.networkId,
//           },
//         },
//         data: { balance: { increment: payout } },
//       });
//     }
//     await tx.order.update({
//       where: { id: order.id },
//       data: {
//         status: "SETTLED",
//         result: won ? "WIN" : "LOSS",
//         settledAt: new Date(),
//       },
//     });
//   });
// };
const getUserOrders = async (req, res) => {
    try {
        const userId = req.user.userId;
        const orders = await prisma_1.prisma.order.findMany({
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
    }
    catch (error) {
        console.error("getUserOrders error:", error);
        res.status(500).json({ error: "Failed to fetch orders" });
    }
};
exports.getUserOrders = getUserOrders;
/* =========================================
   ADMIN: GET ALL ORDERS
========================================= */
const adminGetOrders = async (req, res) => {
    try {
        const page = Number(req.query.page) || 1;
        const limit = Number(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const [orders, total] = await Promise.all([
            prisma_1.prisma.order.findMany({
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
            prisma_1.prisma.order.count(),
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
    }
    catch (error) {
        console.error("adminGetOrders error:", error);
        return res.status(500).json({ error: "Failed to fetch orders" });
    }
};
exports.adminGetOrders = adminGetOrders;
/* =========================================
   ADMIN: SETTLE ORDER (MANUAL)
========================================= */
const adminSettleOrder = async (req, res) => {
    try {
        const { id } = req.params;
        const { result } = req.body; // "WIN" or "LOSS"
        if (!["WIN", "LOSS"].includes(result)) {
            return res
                .status(400)
                .json({ error: "Invalid result. Must be WIN or LOSS" });
        }
        const order = await prisma_1.prisma.order.findUnique({
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
        await prisma_1.prisma.$transaction(async (tx) => {
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
                    result: result,
                    settledAt: new Date(),
                },
            });
        });
        return res.json({ message: "Order settled successfully" });
    }
    catch (error) {
        console.error("adminSettleOrder error:", error);
        return res.status(500).json({ error: "Failed to settle order" });
    }
};
exports.adminSettleOrder = adminSettleOrder;
