import { Request, Response, NextFunction } from "express";
import { verifyAccessToken } from "../utils/token";
import { prisma } from "../utils/prisma";

export interface AuthRequest extends Request {
  user?: {
    userId: string;
    role: string;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.split(" ")[1]
    : null;

  if (!token) {
    return res.status(401).json({ error: "Access token required" });
  }

  try {
    const decoded = verifyAccessToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "Invalid or expired token" });
    }

    const user = await prisma.user.findUnique({
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
      return res
        .status(401)
        .json({ error: "Session expired. Please log in again." });
    }

    if (user.suspended) {
      return res.status(403).json({ error: "Account is suspended" });
    }

    req.user = {
      userId: user.id,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("authenticateToken error:", error);
    return res.status(500).json({ error: "Authentication failed" });
  }
};

export const requireRole = (role: "ADMIN" | "USER") => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }
    next();
  };
};
