"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUserTransactionById = exports.getUserTransactions = void 0;
const prisma_1 = require("../utils/prisma");
/**
 * GET /transactions
 * Fetch authenticated user's transactions
 * Supports filters: status, type, coinId, networkId
 */
const getUserTransactions = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { status, type, coinId, networkId } = req.query;
        const where = {
            userId,
        };
        if (type) {
            where.type = String(type).toUpperCase();
        }
        if (status && String(status) !== "all") {
            where.status = String(status).toUpperCase();
        }
        // Filter via wallet relation
        if (coinId || networkId) {
            where.wallet = {
                is: {
                    ...(coinId && { coinId: String(coinId) }),
                    ...(networkId && { networkId: String(networkId) }),
                },
            };
        }
        const transactions = await prisma_1.prisma.transaction.findMany({
            where,
            orderBy: { createdAt: "desc" },
            include: {
                wallet: {
                    include: {
                        coin: {
                            select: { id: true, symbol: true, name: true, iconUrl: true },
                        },
                        network: {
                            select: { id: true, name: true, type: true },
                        },
                    },
                },
            },
        });
        const payload = transactions.map((tx) => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            status: tx.status,
            createdAt: tx.createdAt,
            coin: tx.wallet?.coin ?? null,
            network: tx.wallet?.network ?? null,
            // Useful UX fields
        }));
        return res.json({
            success: true,
            count: payload.length,
            transactions: payload,
        });
    }
    catch (err) {
        console.error("getUserTransactions error", err);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch transactions",
        });
    }
};
exports.getUserTransactions = getUserTransactions;
/**
 * GET /transactions/:id
 * Fetch a single transaction (user-scoped)
 */
const getUserTransactionById = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { id } = req.params;
        const tx = await prisma_1.prisma.transaction.findFirst({
            where: {
                id,
                userId, // 🔒 user ownership enforced
            },
            include: {
                wallet: {
                    include: {
                        coin: true,
                        network: true,
                    },
                },
            },
        });
        if (!tx) {
            return res.status(404).json({
                success: false,
                error: "Transaction not found",
            });
        }
        return res.json({
            success: true,
            transaction: {
                id: tx.id,
                type: tx.type,
                amount: tx.amount,
                status: tx.status,
                createdAt: tx.createdAt,
                coin: tx.wallet?.coin ?? null,
                network: tx.wallet?.network ?? null,
            },
        });
    }
    catch (err) {
        console.error("getUserTransactionById error", err);
        return res.status(500).json({
            success: false,
            error: "Failed to fetch transaction",
        });
    }
};
exports.getUserTransactionById = getUserTransactionById;
