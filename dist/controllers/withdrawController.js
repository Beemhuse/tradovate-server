"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestBankWithdraw = void 0;
const zod_1 = require("zod");
const prisma_1 = require("../utils/prisma"); // Auth request shape (adjust if your middleware uses different fields)
const bankWithdrawSchema = zod_1.z.object({
    walletId: zod_1.z.string().uuid(), // wallet id to withdraw from
    amount: zod_1.z.number().positive(),
    bankName: zod_1.z.string().min(2),
    accountName: zod_1.z.string().min(2),
    accountNumber: zod_1.z.string().min(4),
    ifscCode: zod_1.z.string().min(4),
    // optional: currency/coinId if you prefer to pass coin
});
const requestBankWithdraw = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: "Unauthorized" });
        const data = bankWithdrawSchema.parse(req.body);
        // Fetch wallet + ensure ownership
        const wallet = await prisma_1.prisma.wallet.findUnique({
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
        const [createdTx, updatedWallet] = await prisma_1.prisma.$transaction([
            prisma_1.prisma.transaction.create({
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
            prisma_1.prisma.wallet.update({
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
    }
    catch (err) {
        if (err instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: err.errors });
        }
        console.error("requestBankWithdraw error:", err);
        return res.status(500).json({ error: "Failed to request withdrawal" });
    }
};
exports.requestBankWithdraw = requestBankWithdraw;
