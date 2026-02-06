import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import { sendOtpEmail } from "../utils/email";
import { generateTokens } from "../utils/token";
import { z } from "zod";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "brightawah94@gmail.com";

const signupSchema = z.object({
  fullName: z.string(),
  email: z.string().email(),
  password: z.string().min(6),
});

const verifyEmailSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

const resetPasswordSchema = z.object({
  email: z.string().email(),
  code: z.string().length(6),
  newPassword: z.string().min(6),
});

const adminSignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

// Helper: Generate & Send OTP
const generateAndSendOtp = async (email: string) => {
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

  await prisma.otp.deleteMany({ where: { email } });
  await prisma.otp.create({ data: { email, code, expiresAt } });

  return sendOtpEmail(email, code);
};

export const signup = async (req: Request, res: Response) => {
  try {
    const { fullName, email, password } = signupSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    // Regular signup always creates USER role
    const role = "USER";

    await prisma.user.create({
      data: {
        fullName,
        email,
        password: hashedPassword,
        role,
        isVerified: false,
      },
    });

    const sent = await generateAndSendOtp(email);
    if (!sent)
      return res
        .status(500)
        .json({ error: "Failed to send verification email" });

    res.json({
      message: "User created. Please check email for OTP to verify.",
    });
  } catch (error: any) {
    console.error("Signup error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }

    return res
      .status(500)
      .json({ error: "Signup failed", detail: error?.message });
  }
};

export const adminSignup = async (req: Request, res: Response) => {
  try {
    const { email, password } = adminSignupSchema.parse(req.body);

    // Check if email is in admin whitelist
    const whitelisted = await prisma.adminWhitelist.findUnique({
      where: { email },
    });
    if (!whitelisted) {
      return res.status(403).json({
        error:
          "Unauthorized. This email is not authorized for admin registration.",
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res.status(400).json({ error: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);

    await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        role: "ADMIN",
        isVerified: false,
      },
    });

    const sent = await generateAndSendOtp(email);
    if (!sent)
      return res
        .status(500)
        .json({ error: "Failed to send verification email" });

    res.json({
      message: "Admin user created. Please check email for OTP to verify.",
    });
  } catch (error: any) {
    console.error("Admin signup error:", error);

    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }

    return res
      .status(500)
      .json({ error: "Admin signup failed", detail: error?.message });
  }
};

export const verifyEmail = async (req: Request, res: Response) => {
  try {
    const { email, code } = verifyEmailSchema.parse(req.body);

    const validOtp = await prisma.otp.findFirst({
      where: { email, code, expiresAt: { gt: new Date() } },
    });
    if (!validOtp)
      return res.status(400).json({ error: "Invalid or expired OTP" });

    await prisma.user.update({
      where: { email },
      data: { isVerified: true },
    });

    await prisma.otp.delete({ where: { id: validOtp.id } });

    // Auto-login? Or ask to login.
    res.json({ message: "Email verified. You can now login." });
  } catch (error) {
    if (error instanceof z.ZodError)
      return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Verification failed" });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = loginSchema.parse(req.body);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.password)
      return res.status(400).json({ error: "Invalid credentials" });

    const validPass = await bcrypt.compare(password, user.password);
    if (!validPass)
      return res.status(400).json({ error: "Invalid credentials" });

    if (!user.isVerified)
      return res.status(403).json({ error: "Email not verified" });

    // Enhanced admin security: verify admin users are still whitelisted
    if (user.role === "ADMIN") {
      const whitelisted = await prisma.adminWhitelist.findUnique({
        where: { email },
      });
      if (!whitelisted) {
        return res.status(403).json({
          error: "Unauthorized. Admin access has been revoked.",
        });
      }
    }

    const { accessToken, refreshToken } = generateTokens(
      user.id,
      user.role,
      user.tokenVersion,
    );

    res.json({ accessToken, refreshToken });
  } catch (error) {
    if (error instanceof z.ZodError)
      return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Login failed" });
  }
};

export const forgotPassword = async (req: Request, res: Response) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    await generateAndSendOtp(email);
    res.json({ message: "OTP sent for password reset" });
  } catch (error) {
    res.status(500).json({ error: "Request failed" });
  }
};

export const resetPassword = async (req: Request, res: Response) => {
  try {
    const { email, code, newPassword } = resetPasswordSchema.parse(req.body);

    const validOtp = await prisma.otp.findFirst({
      where: { email, code, expiresAt: { gt: new Date() } },
    });
    if (!validOtp)
      return res.status(400).json({ error: "Invalid or expired OTP" });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        tokenVersion: { increment: 1 }, // 🔥 invalidate all sessions
      },
    });

    await prisma.otp.delete({ where: { id: validOtp.id } });
    res.json({ message: "Password reset successful" });
  } catch (error) {
    if (error instanceof z.ZodError)
      return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Reset failed" });
  }
};
// Keep requestOtp for backward compatibility if needed, or remove.
export const resendOtp = async (req: Request, res: Response) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body); // Reuse simple email schema

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ error: "User not found" });

    await generateAndSendOtp(email);
    res.json({ message: "OTP resent successfully" });
  } catch (error) {
    if (error instanceof z.ZodError)
      return res.status(400).json({ error: error.errors });
    res.status(500).json({ error: "Resend OTP failed" });
  }
};

export const logout = async (_req: Request, res: Response) => {
  // 🔐 Logout is client-side:
  // - frontend deletes accessToken
  // - frontend deletes refreshToken
  return res.status(200).json({
    message: "Logged out successfully",
  });
};

// Local request type that includes user from your auth middleware
type AuthRequest = Request & {
  user?: { userId: string; role?: string; email?: string };
};

export const getMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    // include related data you want to expose
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        // wallets: {
        //   include: { coin: true },
        // },
        // transactions: {
        //   orderBy: { createdAt: "desc" },
        //   take: 10,
        // },
        kyc: true, // optional: include KYC if you added model
      },
    });
    // const response = await fetch("http://localhost:6001/api/v1/events", {
    //   method: "POST",
    //   headers: {
    //     "X-API-Key":
    //       "nsk_553999d3978e7da9bf8da3308eff9e08045ce5ee5451bddbf04823690b048442",
    //     "Content-Type": "application/json",
    //   },
    //   body: JSON.stringify({
    //     source: "tradovate",
    //     title: "Payment Processed",
    //     type: "application.payment_error",
    //     severity: "error",
    //     event: "PAYMENT",
    //     message: "Payment processed successfully",
    //     payload: {
    //       orderId: "12345",
    //       amount: 99.99,
    //     },
    //   }),
    // });
    // console.log("Event logged with status:", response.status);
    if (!user) return res.status(404).json({ error: "User not found" });

    // Remove sensitive fields before sending
    // (password is optional in your schema but remove if present)
    const { password, ...sanitized } = user as any;

    return res.json(sanitized);
  } catch (error) {
    console.error("getMe error:", error);
    return res.status(500).json({ error: "Failed to fetch user" });
  }
};

export const updateMe = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { fullName } = req.body;

    if (!fullName || typeof fullName !== "string") {
      return res.status(400).json({
        error: "fullName is required",
      });
    }

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        fullName: fullName.trim(),
      },
      include: {
        wallets: {
          include: { coin: true },
        },
        transactions: {
          orderBy: { createdAt: "desc" },
          take: 10,
        },
        kyc: true,
      },
    });

    // 🧼 Remove sensitive fields
    const { password, ...sanitized } = updatedUser as any;

    return res.json(sanitized);
  } catch (error) {
    console.error("updateMe error:", error);
    return res.status(500).json({ error: "Failed to update user" });
  }
};

export const forceChangePassword = async (req: Request, res: Response) => {
  try {
    const { email, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json({
        error: "Password must be at least 8 characters",
      });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        tokenVersion: {
          increment: 1, // 🔥 INVALIDATES ALL TOKENS
        },
      },
    });

    return res.json({
      message: "Password changed successfully. Please log in again.",
    });
  } catch (error) {
    console.error("forceChangePassword error:", error);
    return res.status(500).json({ error: "Password reset failed" });
  }
};
