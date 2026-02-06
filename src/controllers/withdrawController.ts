// src/controllers/withdrawController.ts
import { Request, Response } from "express";
import { z } from "zod";
import { prisma } from "../utils/prisma"; // Auth request shape (adjust if your middleware uses different fields)
type AuthRequest = Request & {
  user?: { userId: string; id?: string; role?: string };
};

const bankWithdrawSchema = z.object({
  walletId: z.string().uuid(), // wallet id to withdraw from
  amount: z.coerce.number().positive(),
  bankName: z.string().min(2),
  accountName: z.string().min(2),
  accountNumber: z.string().min(4),
  ifscCode: z.string().min(4),
  // optional: currency/coinId if you prefer to pass coin
});

export const requestBankWithdraw = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const data = bankWithdrawSchema.parse(req.body);

    // Fetch wallet + ensure ownership
    const wallet = await prisma.wallet.findUnique({
      where: { id: data.walletId },
    });

    if (!wallet) {
      return res.status(404).json({ error: "Wallet not found" });
    }
    if (wallet.userId !== userId) {
      return res
        .status(403)
        .json({ error: "Forbidden: wallet does not belong to user" });
    }

    // Ensure sufficient balance
    if (data.amount > wallet.balance) {
      return res.status(400).json({ error: "Insufficient balance" });
    }

    // Use a transaction to atomically create the transaction record and update wallet balance
    const [createdTx, updatedWallet] = await prisma.$transaction([
      prisma.transaction.create({
        data: {
          userId,
          walletId: wallet.id,
          type: "BANK_WITHDRAW", // TransactionType.WITHDRAW
          amount: data.amount,
          status: "PENDING", // admin or processor will mark COMPLETED later
          bankName: data.bankName,
          accountName: data.accountName,
          accountNumber: data.accountNumber,
          ifscCode: data.ifscCode,
        },
      }),
      prisma.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: data.amount }, // subtract immediately to prevent double spend
        },
      }),
    ]);

    // Optionally notify finance/admin or enqueue payout job here

    return res.status(201).json({
      message: "Withdrawal requested",
      transaction: createdTx,
      wallet: updatedWallet,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ error: err.errors });
    }
    console.error("requestBankWithdraw error:", err);
    return res.status(500).json({ error: "Failed to request withdrawal" });
  }
};
