"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceFinancialAccess = void 0;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error("DATABASE_URL is not set. Set it in your environment before running the seed.");
}
const adapter = new adapter_pg_1.PrismaPg({ connectionString });
// PrismaClientOptions typings may not include `adapter`, cast to any to satisfy TS.
const prisma = new client_1.PrismaClient({ adapter });
const enforceFinancialAccess = async (userId, res) => {
    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            suspended: true,
            isVerified: true,
            kycStatus: true,
        },
    });
    if (!user) {
        res.status(404).json({ error: "User not found" });
        return false;
    }
    if (user.suspended) {
        res.status(403).json({
            error: "Account suspended",
            message: "Your account is suspended. Contact support.",
        });
        return false;
    }
    if (!user.isVerified) {
        res.status(403).json({
            error: "Email not verified",
            message: "Please verify your email before performing transactions.",
        });
        return false;
    }
    if (user.kycStatus !== client_1.KycStatus.APPROVED) {
        res.status(403).json({
            error: "KYC not approved",
            message: user.kycStatus === "PENDING"
                ? "KYC verification is pending approval."
                : "KYC verification was rejected. Please resubmit.",
            kycStatus: user.kycStatus,
        });
        return false;
    }
    return true;
};
exports.enforceFinancialAccess = enforceFinancialAccess;
