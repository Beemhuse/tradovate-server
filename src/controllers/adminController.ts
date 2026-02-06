import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { Network, CoinNetwork } from "@prisma/client";

import { z } from "zod";
import {
  handlePrismaError,
  isPrismaError,
} from "../utils/prisma-error-handler";
import { AuthRequest } from "middlewares/authMiddleware";

const suspendSchema = z.object({
  suspend: z.boolean(),
  reason: z.string().optional().nullable(),
});
// Schemas
const createCoinSchema = z.object({
  symbol: z.string().min(1).toUpperCase(),
  name: z.string().min(1),
  iconUrl: z.string().optional(),
  isActive: z.boolean().optional().default(true),
});

const updateCoinSchema = z.object({
  symbol: z.string().min(1).toUpperCase().optional(),
  name: z.string().min(1).optional(),
  iconUrl: z.string().optional(),
  isActive: z.boolean().optional(),
});

const linkCoinNetworkSchema = z.object({
  coinId: z.string(),
  networkId: z.string(),
  contractAddress: z.string().optional(),
  decimals: z.number().optional(),
});

export const createCoin = async (req: Request, res: Response) => {
  try {
    const schema = createCoinSchema.extend({
      networkId: z.string().uuid().optional(),
      networkName: z.string().optional(),
      networkType: z.string().optional(),
      contractAddress: z.string().optional(),
      decimals: z.number().optional().default(18),
    });

    const data = schema.parse(req.body);
    const {
      networkId,
      networkName,
      networkType,
      contractAddress,
      decimals,
      ...coinData
    } = data;

    const result = await prisma.$transaction(async (tx) => {
      // 1️⃣ FIND or CREATE coin (KEY FIX)
      const coin =
        (await tx.coin.findFirst({
          where: {
            symbol: coinData.symbol,
            name: coinData.name,
          },
        })) ??
        (await tx.coin.create({
          data: coinData,
        }));

      let coinNetwork: (CoinNetwork & { network: Network }) | null = null;

      // 2️⃣ Attach network if provided
      if (networkId || networkName) {
        let network: Network | null = null;

        if (networkId) {
          network = await tx.network.findUnique({
            where: { id: networkId },
          });
        } else if (networkName) {
          network = await tx.network.findFirst({
            where: {
              name: networkName,
              ...(networkType ? { type: networkType } : {}),
            },
          });
        }

        if (!network && networkName) {
          network = await tx.network.create({
            data: {
              name: networkName,
              type: networkType || "CUSTOM",
              isActive: true,
            },
          });
        }

        if (!network) {
          throw new Error("Network could not be resolved");
        }

        const isNative =
          network.type?.toLowerCase().includes("native") ?? false;

        if (!isNative && !contractAddress) {
          throw new Error(
            `Contract address is required for ${network.type} tokens`,
          );
        }

        // 3️⃣ Idempotent coin-network link (KEY FIX)
        coinNetwork =
          (await tx.coinNetwork.findFirst({
            where: {
              coinId: coin.id,
              networkId: network.id,
              contractAddress: contractAddress ?? null,
            },
            include: { network: true },
          })) ??
          (await tx.coinNetwork.create({
            data: {
              coinId: coin.id,
              networkId: network.id,
              contractAddress: contractAddress ?? null,
              decimals,
              isActive: true,
            },
            include: { network: true },
          }));
      }

      return { coin, coinNetwork };
    });

    return res.status(201).json({
      success: true,
      message: result.coinNetwork
        ? "Coin saved and linked to network"
        : "Coin saved successfully",
      coin: result.coin,
      coinNetwork: result.coinNetwork,
    });
  } catch (error) {
    console.error("Create coin error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Validation failed",
        details: error.errors,
      });
    }

    return res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : "Failed to create coin",
    });
  }
};

export const getAllCoins = async (req: Request, res: Response) => {
  try {
    const { includeInactive = "false" } = req.query;

    const coins = await prisma.coin.findMany({
      where: includeInactive === "true" ? {} : { isActive: true },
      include: {
        networks: {
          include: {
            network: true,
          },
        },
        _count: {
          select: {
            wallets: true,
            orders: true,
            networks: true,
          },
        },
      },
      orderBy: [{ isActive: "desc" }, { name: "asc" }],
    });

    res.json({
      success: true,
      count: coins.length,
      coins,
    });
  } catch (error) {
    console.error("Get all coins error:", error);
    res.status(500).json({
      error: "Failed to fetch coins",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getCoinById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const coin = await prisma.coin.findUnique({
      where: { id },
      include: {
        networks: {
          include: {
            network: true,
          },
        },
        wallets: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                isVerified: true,
              },
            },
          },
          take: 10,
        },
        orders: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        _count: {
          select: {
            wallets: true,
            orders: true,
            networks: true,
          },
        },
      },
    });

    if (!coin) {
      return res.status(404).json({
        error: "Coin not found",
        details: `Coin with ID ${id} does not exist`,
      });
    }

    res.json({
      success: true,
      coin,
    });
  } catch (error) {
    console.error("Get coin by ID error:", error);
    res.status(500).json({
      error: "Failed to fetch coin",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const updateCoin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = updateCoinSchema.parse(req.body);

    // Check if coin exists
    const existingCoin = await prisma.coin.findUnique({
      where: { id },
    });

    if (!existingCoin) {
      return res.status(404).json({
        error: "Coin not found",
        details: `Coin with ID ${id} does not exist`,
      });
    }

    // If symbol is being updated, check for conflicts
    if (data.symbol && data.symbol !== existingCoin.symbol) {
      const symbolConflict = await prisma.coin.findUnique({
        where: { symbol: data.symbol },
      });

      if (symbolConflict) {
        return res.status(409).json({
          error: "Symbol conflict",
          details: `Another coin with symbol ${data.symbol} already exists`,
        });
      }
    }

    const coin = await prisma.coin.update({
      where: { id },
      data,
      include: {
        networks: {
          include: { network: true },
        },
      },
    });

    res.json({
      success: true,
      message: "Coin updated successfully",
      coin,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    console.error("Update coin error:", error);
    res.status(500).json({
      error: "Failed to update coin",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

/**
 * Deactivate a coin if it has at least one wallet created by a user
 */
export const deactivateCoin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const coin = await prisma.coin.findUnique({
      where: { id },
      include: {
        wallets: { select: { id: true } },
      },
    });

    if (!coin) {
      return res.status(404).json({
        error: "Coin not found",
      });
    }

    /**
     * CASE 1:
     * No wallets → Safe to DELETE coin
     */
    if (coin.wallets.length === 0) {
      await prisma.coin.delete({
        where: { id },
      });

      return res.json({
        success: true,
        message: "Coin deleted successfully (no wallets existed)",
      });
    }

    /**
     * CASE 2:
     * Wallets exist → Deactivate coin
     */
    if (!coin.isActive) {
      return res.status(400).json({
        error: "Coin already inactive",
      });
    }

    const updatedCoin = await prisma.coin.update({
      where: { id },
      data: { isActive: false },
    });

    res.json({
      success: true,
      message: "Coin deactivated successfully",
      coin: updatedCoin,
    });
  } catch (error) {
    console.error("Deactivate/Delete coin error:", error);
    res.status(500).json({
      error: "Failed to process coin action",
    });
  }
};

/**
 * Reactivate a previously deactivated coin
 */
export const reactivateCoin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const coin = await prisma.coin.findUnique({
      where: { id },
    });

    if (!coin) {
      return res.status(404).json({
        error: "Coin not found",
      });
    }

    if (coin.isActive) {
      return res.status(400).json({
        error: "Coin already active",
      });
    }

    const updatedCoin = await prisma.coin.update({
      where: { id },
      data: { isActive: true },
    });

    res.json({
      success: true,
      message: "Coin reactivated successfully",
      coin: updatedCoin,
    });
  } catch (error) {
    console.error("Reactivate coin error:", error);
    res.status(500).json({
      error: "Failed to reactivate coin",
    });
  }
};

export const toggleCoinStatus = async (req: Request, res: Response) => {
  try {
    const { coinId, toggleNetworks = true } = req.body;
    console.log(coinId, toggleNetworks);
    if (!coinId) {
      return res.status(400).json({
        error: "coinId is required",
      });
    }

    // 1️⃣ Check if coin exists
    const coin = await prisma.coin.findUnique({
      where: { id: coinId },
      include: {
        networks: true,
        _count: {
          select: {
            wallets: true,
            orders: true,
            networks: true,
          },
        },
      },
    });

    if (!coin) {
      return res.status(404).json({
        error: "Coin not found",
      });
    }

    const newStatus = !coin.isActive;

    // 2️⃣ Atomic toggle
    const updatedCoin = await prisma.$transaction(async (tx) => {
      const updated = await tx.coin.update({
        where: { id: coinId },
        data: { isActive: newStatus },
      });

      // 3️⃣ Optionally toggle coin networks
      if (toggleNetworks) {
        await tx.coinNetwork.updateMany({
          where: { coinId },
          data: { isActive: newStatus },
        });
      }

      return updated;
    });

    res.json({
      success: true,
      message: `Coin ${newStatus ? "activated" : "deactivated"} successfully`,
      data: {
        id: updatedCoin.id,
        isActive: updatedCoin.isActive,
        walletsAffected: coin._count.wallets,
        ordersAffected: coin._count.orders,
        networksAffected: coin._count.networks,
        networksToggled: toggleNetworks,
      },
    });
  } catch (error) {
    console.error("Toggle coin status error:", error);
    res.status(500).json({
      error: "Failed to toggle coin status",
    });
  }
};

export const deleteCoin = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { force = "false" } = req.query;

    // Check if coin exists
    const coin = await prisma.coin.findUnique({
      where: { id },
      include: {
        networks: {
          include: { network: true },
        },
        _count: {
          select: {
            wallets: true,
            orders: true,
            networks: true,
          },
        },
      },
    });

    if (!coin) {
      return res.status(404).json({
        error: "Coin not found",
        details: `Coin with ID ${id} does not exist`,
      });
    }

    // Check if coin can be safely deleted
    if (force !== "true") {
      const hasWallets = coin._count.wallets > 0;
      const hasOrders = coin._count.orders > 0;

      if (hasWallets || hasOrders) {
        return res.status(400).json({
          error: "Cannot delete coin",
          details: "Coin has active references",
          references: {
            wallets: coin._count.wallets,
            orders: coin._count.orders,
            networks: coin._count.networks,
          },
          suggestion: "Use ?force=true to force delete, or deactivate instead",
        });
      }
    }

    // Use transaction for safe deletion
    const result = await prisma.$transaction(async (prisma) => {
      // First delete all CoinNetwork associations
      await prisma.coinNetwork.deleteMany({
        where: { coinId: id },
      });

      // Then delete the coin
      return await prisma.coin.delete({
        where: { id },
      });
    });

    res.json({
      success: true,
      message: "Coin deleted permanently",
      details: {
        coin: coin.name,
        symbol: coin.symbol,
        networksDeleted: coin._count.networks,
        forceDeleted: force === "true",
      },
    });
  } catch (error) {
    console.error("Delete coin error:", error);

    if (isPrismaError(error)) {
      const { status, message, details } = handlePrismaError(error);
      return res.status(status).json({
        error: message,
        details,
        prismaCode: error.code,
      });
    }

    // Fallback for completely unknown errors
    res.status(500).json({
      error: "Failed to delete coin",
      details: "An unknown error occurred",
    });
  }
};

export const linkCoinToNetwork = async (req: Request, res: Response) => {
  try {
    const data = linkCoinNetworkSchema.parse(req.body);

    // Check if coin exists
    const coin = await prisma.coin.findUnique({
      where: { id: data.coinId },
    });

    if (!coin) {
      return res.status(404).json({
        error: "Coin not found",
        details: `Coin with ID ${data.coinId} does not exist`,
      });
    }

    // Check if network exists
    const network = await prisma.network.findUnique({
      where: { id: data.networkId },
    });

    if (!network) {
      return res.status(404).json({
        error: "Network not found",
        details: `Network with ID ${data.networkId} does not exist`,
      });
    }

    // Check if link already exists
    const existingLink = await prisma.coinNetwork.findFirst({
      where: {
        coinId: data.coinId,
        networkId: data.networkId,
      },
    });

    if (existingLink) {
      return res.status(409).json({
        error: "Link already exists",
        details: `Coin ${coin.symbol} is already linked to network ${network.name}`,
        link: existingLink,
      });
    }

    // For contract addresses, check uniqueness within the network
    if (data.contractAddress) {
      const existingContract = await prisma.coinNetwork.findFirst({
        where: {
          networkId: data.networkId,
          contractAddress: data.contractAddress,
        },
      });

      if (existingContract) {
        return res.status(409).json({
          error: "Contract address already in use",
          details: `Contract address ${data.contractAddress} is already used for another coin on this network`,
        });
      }
    }

    const link = await prisma.coinNetwork.create({
      data: {
        ...data,
        isActive: true,
      },
      include: {
        coin: true,
        network: true,
      },
    });

    res.status(201).json({
      success: true,
      message: "Coin linked to network successfully",
      link,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: "Validation failed",
        details: error.errors,
      });
    }

    console.error("Link coin to network error:", error);
    res.status(500).json({
      error: "Failed to link coin to network",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const unlinkCoinFromNetwork = async (req: Request, res: Response) => {
  try {
    const { coinId, networkId } = req.params;

    // Check if link exists
    const link = await prisma.coinNetwork.findFirst({
      where: {
        coinId,
        networkId,
      },
      include: {
        coin: true,
        network: true,
      },
    });

    if (!link) {
      return res.status(404).json({
        error: "Link not found",
        details: `No link found between coin ${coinId} and network ${networkId}`,
      });
    }

    // Check if there are wallets using this link
    const walletsCount = await prisma.wallet.count({
      where: {
        coinId,
        contractAddress: link.contractAddress,
      },
    });

    if (walletsCount > 0) {
      return res.status(400).json({
        error: "Cannot unlink",
        details: "There are wallets using this coin-network combination",
        walletsCount,
        suggestion: "Deactivate the link instead or migrate wallets first",
      });
    }

    await prisma.coinNetwork.delete({
      where: { id: link.id },
    });

    res.json({
      success: true,
      message: "Coin unlinked from network successfully",
      details: {
        coin: link.coin.name,
        network: link.network.name,
      },
    });
  } catch (error) {
    console.error("Unlink coin from network error:", error);
    res.status(500).json({
      error: "Failed to unlink coin from network",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

export const getCoinNetworks = async (req: Request, res: Response) => {
  try {
    const { coinId } = req.params;

    // Check if coin exists
    const coin = await prisma.coin.findUnique({
      where: { id: coinId },
    });

    if (!coin) {
      return res.status(404).json({
        error: "Coin not found",
        details: `Coin with ID ${coinId} does not exist`,
      });
    }

    const networks = await prisma.coinNetwork.findMany({
      where: { coinId },
      include: {
        network: true,
      },
      orderBy: { network: { name: "asc" } },
    });

    res.json({
      success: true,
      count: networks.length,
      coin: {
        id: coin.id,
        name: coin.name,
        symbol: coin.symbol,
      },
      networks,
    });
  } catch (error) {
    console.error("Get coin networks error:", error);
    res.status(500).json({
      error: "Failed to fetch coin networks",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};

// User Management functions remain the same...
export const getAllUsersWithWallets = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        wallets: {
          include: { coin: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const sanitizedUsers = users.map((user) => {
      const { password, ...rest } = user;

      // SUM ALL WALLET BALANCES
      const totalBalance = user.wallets.reduce(
        (sum, w) => sum + (w.balance || 0),
        0,
      );

      return {
        ...rest,
        totalBalance,
      };
    });

    return res.json({
      success: true,
      count: sanitizedUsers.length,
      users: sanitizedUsers,
    });
  } catch (error) {
    console.error("Fetch users error:", error);
    return res.status(500).json({ error: "Failed to fetch users" });
  }
};

export const getUserById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        wallets: { include: { coin: true } },
        transactions: { orderBy: { createdAt: "desc" } },
        kyc: true,
        orders: true,
      },
    });

    if (!user) return res.status(404).json({ error: "User not found" });

    const { password, ...rest } = user as any;
    res.json(rest);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch user" });
  }
};

const updateWalletSchema = z.object({
  walletId: z.string(),
  balance: z.number().optional(),
});

export const updateUserWallet = async (req: Request, res: Response) => {
  try {
    const { walletId, balance } = updateWalletSchema.parse(req.body);

    const wallet = await prisma.wallet.update({
      where: { id: walletId },
      data: {
        balance: balance !== undefined ? balance : undefined,
      },
      include: { coin: true },
    });

    res.json(wallet);
  } catch (error) {
    res.status(400).json({ error: "Update failed" });
  }
};

export const suspendUser = async (req: AuthRequest, res: Response) => {
  try {
    const adminId = req.user?.userId;
    const userId = req.params.id;
    if (!userId)
      return res.status(400).json({ success: false, error: "Missing user id" });

    const parsed = suspendSchema.parse(req.body);
    const { suspend, reason } = parsed;

    // Ensure target user exists
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target)
      return res.status(404).json({ success: false, error: "User not found" });

    // Prevent suspending an admin (optional)
    if (target.role === "ADMIN") {
      return res
        .status(403)
        .json({ success: false, error: "Cannot suspend admin users" });
    }

    const data: any = {
      suspended: suspend,
      suspendedReason: suspend ? (reason ?? null) : null,
      suspendedBy: suspend ? (adminId ?? null) : null,
      suspendedAt: suspend ? new Date() : null,
    };

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        role: true,
        suspended: true,
        suspendedAt: true,
        suspendedReason: true,
        suspendedBy: true,
        kycStatus: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // Optionally: invalidate any active sessions / tokens here
    // e.g., create a blacklisted token entry or call session service.

    return res.json({
      success: true,
      message: suspend ? "User suspended" : "User unsuspended",
      user: updated,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        error: "Invalid payload",
        details: err.errors,
      });
    }
    console.error("suspendUser error", err);
    return res
      .status(500)
      .json({ success: false, error: "Failed to update user suspension" });
  }
};
// Add these to your existing adminController.ts file:

// Get market coins (public endpoint - for frontend display)
export const getMarketCoins = async (req: Request, res: Response) => {
  try {
    const coins = await prisma.coin.findMany({
      where: { isActive: true },
      include: {
        networks: {
          where: { isActive: true },
          include: {
            network: true,
          },
        },
      },
      orderBy: { name: "asc" },
    });

    res.json({
      success: true,
      count: coins.length,
      coins,
    });
  } catch (error) {
    console.error("Get market coins error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to fetch market coins",
      details: error instanceof Error ? error.message : "Unknown error",
    });
  }
};
