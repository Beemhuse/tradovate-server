"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireRole = exports.authenticateToken = void 0;
const token_1 = require("../utils/token");
const prisma_1 = require("../utils/prisma");
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith("Bearer ")
        ? authHeader.split(" ")[1]
        : null;
    if (!token) {
        return res.status(401).json({ error: "Access token required" });
    }
    try {
        const decoded = (0, token_1.verifyAccessToken)(token);
        if (!decoded) {
            return res.status(401).json({ error: "Invalid or expired token" });
        }
        const user = await prisma_1.prisma.user.findUnique({
            where: { id: decoded.userId },
            select: {
                id: true,
                role: true,
                tokenVersion: true,
                suspended: true,
            },
        });
        if (!user) {
            return res.status(401).json({ error: "User no longer exists" });
        }
        // 🔥 TOKEN INVALIDATION CHECK
        if (user.tokenVersion !== decoded.tokenVersion) {
            return res.status(401).json({ error: "Session expired. Please log in again." });
        }
        if (user.suspended) {
            return res.status(403).json({ error: "Account is suspended" });
        }
        req.user = {
            userId: user.id,
            role: user.role,
        };
        next();
    }
    catch (error) {
        console.error("authenticateToken error:", error);
        return res.status(500).json({ error: "Authentication failed" });
    }
};
exports.authenticateToken = authenticateToken;
const requireRole = (role) => {
    return (req, res, next) => {
        if (!req.user || req.user.role !== role) {
            return res.status(403).json({ error: "Insufficient permissions" });
        }
        next();
    };
};
exports.requireRole = requireRole;
