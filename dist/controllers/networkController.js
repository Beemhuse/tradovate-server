"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getUSDTByNetwork = exports.getNetworks = exports.addCoinNetwork = exports.deleteCoinNetwork = exports.updateCoinNetwork = exports.getNetworkById = exports.deleteNetwork = exports.deactivateNetwork = exports.updateNetwork = exports.createNetwork = void 0;
const prisma_1 = require("../utils/prisma");
const zod_1 = require("zod");
const prisma_error_handler_1 = require("../utils/prisma-error-handler");
// Update network
const updateNetworkSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).optional(),
    type: zod_1.z.string().optional(),
    chainId: zod_1.z.string().optional(),
    rpcUrl: zod_1.z.string().optional(),
    explorerUrl: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional(),
});
const createNetworkSchema = zod_1.z.object({
    name: zod_1.z.string().min(1),
    type: zod_1.z.string().optional(),
    chainId: zod_1.z.string().optional(),
    rpcUrl: zod_1.z.string().optional(),
    explorerUrl: zod_1.z.string().optional(),
    isActive: zod_1.z.boolean().optional().default(true),
});
// Network Management
const createNetwork = async (req, res) => {
    try {
        const data = createNetworkSchema.parse(req.body);
        // Check if network with same name already exists
        const existingNetwork = await prisma_1.prisma.network.findFirst({
            where: {
                OR: [
                    { name: data.name },
                    { type: data.type }
                ]
            }
        });
        if (existingNetwork) {
            return res.status(409).json({
                error: "Network already exists",
                details: existingNetwork.name === data.name
                    ? `A network with name ${data.name} already exists`
                    : `A network with type ${data.type} already exists`
            });
        }
        const network = await prisma_1.prisma.network.create({ data });
        res.status(201).json({
            success: true,
            message: "Network created successfully",
            network
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                error: "Validation failed",
                details: error.errors
            });
        }
        console.error("Create network error:", error);
        res.status(500).json({
            error: "Failed to create network",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
exports.createNetwork = createNetwork;
const updateNetwork = async (req, res) => {
    try {
        const { id } = req.params;
        const data = updateNetworkSchema.parse(req.body);
        // Check if network exists
        const existingNetwork = await prisma_1.prisma.network.findUnique({
            where: { id }
        });
        if (!existingNetwork) {
            return res.status(404).json({
                success: false,
                error: "Network not found",
                details: `Network with ID ${id} does not exist`
            });
        }
        const network = await prisma_1.prisma.network.update({
            where: { id },
            data,
            include: {
                coins: {
                    include: {
                        coin: true
                    }
                }
            }
        });
        res.json({
            success: true,
            message: "Network updated successfully",
            network
        });
    }
    catch (error) {
        console.error("Update network error:", error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({
                success: false,
                error: "Validation failed",
                details: error.errors
            });
        }
        res.status(500).json({
            success: false,
            error: "Failed to update network",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
exports.updateNetwork = updateNetwork;
// Deactivate network
const deactivateNetwork = async (req, res) => {
    try {
        const { id } = req.params;
        const network = await prisma_1.prisma.network.findUnique({
            where: { id },
            include: {
                coins: {
                    include: {
                        coin: true
                    }
                },
                _count: {
                    select: {
                        coins: true,
                        wallets: true
                    }
                }
            }
        });
        if (!network) {
            return res.status(404).json({
                success: false,
                error: "Network not found",
                details: `Network with ID ${id} does not exist`
            });
        }
        await prisma_1.prisma.network.update({
            where: { id },
            data: { isActive: false }
        });
        res.json({
            success: true,
            message: "Network deactivated successfully",
            details: {
                network: network.name,
                coinsAffected: network._count.coins,
                walletsAffected: network._count.wallets
            }
        });
    }
    catch (error) {
        console.error("Deactivate network error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to deactivate network",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
exports.deactivateNetwork = deactivateNetwork;
// Delete network
const deleteNetwork = async (req, res) => {
    try {
        const { id } = req.params;
        const { force = "false" } = req.query;
        const network = await prisma_1.prisma.network.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        coins: true,
                        wallets: true
                    }
                }
            }
        });
        if (!network) {
            return res.status(404).json({
                success: false,
                error: "Network not found",
                details: `Network with ID ${id} does not exist`
            });
        }
        // Check if network can be safely deleted
        if (force !== "true" && (network._count.coins > 0 || network._count.wallets > 0)) {
            return res.status(400).json({
                success: false,
                error: "Cannot delete network",
                details: "Network has active references",
                references: {
                    coins: network._count.coins,
                    wallets: network._count.wallets
                },
                suggestion: "Use ?force=true to force delete, or deactivate instead"
            });
        }
        // Use transaction for safe deletion
        await prisma_1.prisma.$transaction(async (prisma) => {
            // First delete all CoinNetwork associations
            await prisma.coinNetwork.deleteMany({
                where: { networkId: id }
            });
            // Then delete the network
            await prisma.network.delete({
                where: { id }
            });
        });
        res.json({
            success: true,
            message: "Network deleted permanently",
            details: {
                network: network.name,
                forceDeleted: force === "true"
            }
        });
    }
    catch (error) {
        console.error("Delete network error:", error);
        if ((0, prisma_error_handler_1.isPrismaError)(error)) {
            const { status, message, details } = (0, prisma_error_handler_1.handlePrismaError)(error);
            return res.status(status).json({
                success: false,
                error: message,
                details,
                prismaCode: error.code
            });
        }
        res.status(500).json({
            success: false,
            error: "Failed to delete network",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
exports.deleteNetwork = deleteNetwork;
// Get network by ID
const getNetworkById = async (req, res) => {
    try {
        const { id } = req.params;
        const network = await prisma_1.prisma.network.findUnique({
            where: { id },
            include: {
                coins: {
                    include: {
                        coin: true
                    }
                },
                wallets: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                isVerified: true
                            }
                        },
                        coin: true
                    },
                    take: 10
                },
                _count: {
                    select: {
                        coins: true,
                        wallets: true
                    }
                }
            }
        });
        if (!network) {
            return res.status(404).json({
                success: false,
                error: "Network not found",
                details: `Network with ID ${id} does not exist`
            });
        }
        res.json({
            success: true,
            network
        });
    }
    catch (error) {
        console.error("Get network by ID error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch network",
            details: error instanceof Error ? error.message : "Unknown error"
        });
    }
};
exports.getNetworkById = getNetworkById;
const updateCoinNetwork = async (req, res) => {
    try {
        const { coinId, networkId } = req.params;
        const { isActive, contractAddress } = req.body;
        // 1️⃣ Ensure mapping exists
        const coinNetwork = await prisma_1.prisma.coinNetwork.findFirst({
            where: {
                coinId,
                networkId,
            },
        });
        if (!coinNetwork) {
            return res.status(404).json({
                error: "Network not linked to coin",
                details: `Network ${networkId} is not associated with coin ${coinId}`,
            });
        }
        // 2️⃣ Update mapping
        const updated = await prisma_1.prisma.coinNetwork.update({
            where: { id: coinNetwork.id },
            data: {
                ...(typeof isActive === "boolean" && { isActive }),
                ...(typeof contractAddress === "string" && {
                    contractAddress,
                }),
            },
        });
        res.json({
            success: true,
            message: "Coin network updated successfully",
            network: updated,
        });
    }
    catch (error) {
        console.error("Update coin network error:", error);
        res.status(500).json({
            error: "Failed to update coin network",
        });
    }
};
exports.updateCoinNetwork = updateCoinNetwork;
const deleteCoinNetwork = async (req, res) => {
    try {
        const { coinId, networkId } = req.params;
        // 1️⃣ Ensure mapping exists
        const coinNetwork = await prisma_1.prisma.coinNetwork.findFirst({
            where: {
                coinId,
                networkId,
            },
        });
        if (!coinNetwork) {
            return res.status(404).json({
                error: "Network not linked to coin",
            });
        }
        // 2️⃣ Delete association
        await prisma_1.prisma.coinNetwork.delete({
            where: { id: coinNetwork.id },
        });
        res.json({
            success: true,
            message: "Network removed from coin successfully",
        });
    }
    catch (error) {
        console.error("Delete coin network error:", error);
        res.status(500).json({
            error: "Failed to remove network from coin",
        });
    }
};
exports.deleteCoinNetwork = deleteCoinNetwork;
const addCoinNetwork = async (req, res) => {
    try {
        const { coinId } = req.params;
        const { networkId, isActive = true } = req.body;
        // 1️⃣ Validate network exists
        const network = await prisma_1.prisma.network.findUnique({
            where: { id: networkId },
        });
        if (!network) {
            return res.status(404).json({
                error: "Network not found",
            });
        }
        // 2️⃣ Prevent duplicates
        const exists = await prisma_1.prisma.coinNetwork.findFirst({
            where: { coinId, networkId },
        });
        if (exists) {
            return res.status(409).json({
                error: "Network already linked to this coin",
            });
        }
        // 3️⃣ Create coinNetwork
        const coinNetwork = await prisma_1.prisma.coinNetwork.create({
            data: {
                coinId,
                networkId,
                isActive,
            },
            include: {
                network: true,
            },
        });
        res.json({
            success: true,
            message: "Network added to coin",
            network: coinNetwork,
        });
    }
    catch (error) {
        console.error("Add coin network error:", error);
        res.status(500).json({
            error: "Failed to add network to coin",
        });
    }
};
exports.addCoinNetwork = addCoinNetwork;
// export const getAllNetworks = async (req: Request, res: Response) => {
//   try {
//     const { includeInactive = "false" } = req.query;
//     const networks = await prisma.network.findMany({
//       where: includeInactive === "true" ? {} : { isActive: true },
//       include: {
//         coins: {
//           include: {
//             coin: true,
//           },
//         },
//         _count: {
//           select: {
//             coins: true,
//           },
//         },
//       },
//       orderBy: [
//         // { isActive: 'desc' },
//         { name: "asc" },
//       ],
//     });
//     res.json({
//       success: true,
//       count: networks.length,
//       networks,
//     });
//   } catch (error) {
//     console.error("Get all networks error:", error);
//     res.status(500).json({
//       error: "Failed to fetch networks",
//       details: error instanceof Error ? error.message : "Unknown error",
//     });
//   }
// };
const getNetworks = async (req, res) => {
    try {
        const { active = "true", // default: only active networks
         } = req.query;
        const networks = await prisma_1.prisma.network.findMany({
            where: {
                ...(active === "true" && { isActive: true }),
            },
            orderBy: {
                name: "asc",
            },
        });
        res.json({
            success: true,
            count: networks.length,
            networks,
        });
    }
    catch (error) {
        console.error("Get networks error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to fetch networks",
        });
    }
};
exports.getNetworks = getNetworks;
// GET /market/networks/:networkId/usdt
const getUSDTByNetwork = async (req, res) => {
    try {
        const { networkId } = req.params;
        const usdt = await prisma_1.prisma.coinNetwork.findFirst({
            where: {
                networkId,
                isActive: true,
                coin: {
                    symbol: "USDT",
                    isActive: true,
                },
            },
            include: {
                coin: {
                    select: { id: true, symbol: true, name: true },
                },
                network: {
                    select: { id: true, name: true, },
                },
            },
        });
        if (!usdt) {
            return res.json({
                success: true,
                usdt: null,
            });
        }
        res.json({
            success: true,
            usdt,
        });
    }
    catch (err) {
        console.error("getUSDTByNetwork error", err);
        res.status(500).json({ success: false, message: "Failed to resolve USDT" });
    }
};
exports.getUSDTByNetwork = getUSDTByNetwork;
