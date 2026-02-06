"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getCoin = exports.getCoins = void 0;
const prisma_1 = require("../utils/prisma");
const qrcode_1 = __importDefault(require("qrcode"));
const getCoins = async (req, res) => {
    try {
        const { active } = req.query;
        const coins = await prisma_1.prisma.coin.findMany({
            where: {
                ...(active === "true" && { isActive: true }),
                ...(active === "false" && { isActive: false }),
            },
            orderBy: {
                symbol: "asc",
            },
            include: {
                networks: {
                    include: {
                        network: {
                            select: {
                                id: true,
                                slug: true,
                                name: true,
                                type: true,
                                chainId: true,
                                icon: true,
                                isActive: true,
                            },
                        },
                    },
                },
                _count: {
                    select: {
                        wallets: true,
                        orders: true,
                    },
                },
            },
        });
        const coinsWithQr = await Promise.all(coins.map(async (coin) => {
            const networks = await Promise.all(coin.networks.map(async (cn) => {
                let qrCode = null;
                if (cn.contractAddress) {
                    try {
                        qrCode = await qrcode_1.default.toDataURL(cn.contractAddress);
                    }
                    catch (err) {
                        console.error(`QR generation failed for ${coin.symbol}`, err);
                    }
                }
                return {
                    id: cn.id,
                    isActive: cn.isActive,
                    contractAddress: cn.contractAddress,
                    qrCode,
                    network: cn.network,
                };
            }));
            return {
                id: coin.id,
                symbol: coin.symbol,
                name: coin.name,
                iconUrl: coin.iconUrl,
                isActive: coin.isActive,
                counts: coin._count,
                networks,
            };
        }));
        res.json({
            success: true,
            count: coinsWithQr.length,
            coins: coinsWithQr,
        });
    }
    catch (error) {
        console.error("getCoins error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch coins",
        });
    }
};
exports.getCoins = getCoins;
const getCoin = async (req, res) => {
    try {
        const { id } = req.params;
        const coin = await prisma_1.prisma.coin.findUnique({
            where: { id },
            include: {
                networks: {
                    include: { network: true },
                },
            },
        });
        if (!coin)
            return res.status(404).json({ error: "Coin not found" });
        const networksWithQr = await Promise.all(coin.networks.map(async (cn) => {
            let qrCode = "";
            if (cn.contractAddress) {
                try {
                    qrCode = await qrcode_1.default.toDataURL(cn.contractAddress);
                }
                catch (e) {
                    console.error("QR Gen Error", e);
                }
            }
            return { ...cn, qrCode };
        }));
        res.json({ ...coin, networks: networksWithQr });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch coin" });
    }
};
exports.getCoin = getCoin;
