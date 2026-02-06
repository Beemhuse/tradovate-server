import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import dayjs from "dayjs";

export const getAdminDashboard = async (req: Request, res: Response) => {
  try {
    /** 📊 COUNTS */
    const [totalUsers, activeCoins, pendingKyc, tradingVolume] =
      await Promise.all([
        prisma.user.count(),

        prisma.coin.count({
          where: { isActive: true },
        }),

        prisma.kyc.count({
          where: { status: "PENDING" },
        }),

        prisma.transaction.aggregate({
          where: {
            type: { in: ["BUY", "SELL"] },
            status: "COMPLETED",
          },
          _sum: { amount: true },
        }),
      ]);

    /** 🕒 RECENT ACTIVITY */
    const recentUsers = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      select: {
        email: true,
        createdAt: true,
      },
    });

    const recentKyc = await prisma.kyc.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
      include: {
        user: { select: { email: true } },
      },
    });

    const recentTx = await prisma.transaction.findMany({
      where: {
        type: { in: ["WITHDRAW", "BANK_WITHDRAW", "DEPOSIT"] },
      },
      orderBy: { createdAt: "desc" },
      take: 5,
      select: {
        id: true,
        type: true,
        createdAt: true,
        user: {
          select: { email: true },
        },
      },
    });

    /** 🧾 Normalize Activity Feed */
    const activity = [
      ...recentUsers.map((u) => ({
        type: "New user registered",
        description: u.email,
        time: u.createdAt,
      })),

      ...recentKyc.map((k) => ({
        type: "KYC submitted",
        description: k.user?.email || "Unknown User",
        time: k.createdAt,
      })),

      ...recentTx.map((t) => ({
        type:
          t.type === "DEPOSIT"
            ? "New deposit"
            : t.type === "WITHDRAW" || t.type === "BANK_WITHDRAW"
              ? "Withdrawal request"
              : "Transaction recorded",
        description: t.user?.email || "Unknown User",
        time: t.createdAt,
      })),
    ]
      .sort((a, b) => (a.time < b.time ? 1 : -1))
      .slice(0, 6);

    return res.json({
      success: true,
      metrics: {
        totalUsers,
        activeCoins,
        pendingKyc,
        tradingVolume: tradingVolume._sum.amount ?? 0,
      },
      activity,
    });
  } catch (error) {
    console.error("Admin dashboard error:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to load dashboard metrics",
    });
  }
};
