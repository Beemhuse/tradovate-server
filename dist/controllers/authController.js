"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.forceChangePassword = exports.updateMe = exports.getMe = exports.logout = exports.resendOtp = exports.resetPassword = exports.forgotPassword = exports.login = exports.verifyEmail = exports.adminSignup = exports.signup = void 0;
const prisma_1 = require("../utils/prisma");
const email_1 = require("../utils/email");
const token_1 = require("../utils/token");
const zod_1 = require("zod");
const bcrypt_1 = __importDefault(require("bcrypt"));
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "brightawah94@gmail.com";
const signupSchema = zod_1.z.object({
    fullName: zod_1.z.string(),
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
const verifyEmailSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    code: zod_1.z.string().length(6),
});
const loginSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string(),
});
const forgotPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
});
const resetPasswordSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    code: zod_1.z.string().length(6),
    newPassword: zod_1.z.string().min(6),
});
const adminSignupSchema = zod_1.z.object({
    email: zod_1.z.string().email(),
    password: zod_1.z.string().min(6),
});
// Helper: Generate & Send OTP
const generateAndSendOtp = async (email) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
    await prisma_1.prisma.otp.deleteMany({ where: { email } });
    await prisma_1.prisma.otp.create({ data: { email, code, expiresAt } });
    return (0, email_1.sendOtpEmail)(email, code);
};
const signup = async (req, res) => {
    try {
        const { fullName, email, password } = signupSchema.parse(req.body);
        const existingUser = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existingUser)
            return res.status(400).json({ error: "User already exists" });
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        // Regular signup always creates USER role
        const role = "USER";
        await prisma_1.prisma.user.create({
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
    }
    catch (error) {
        console.error("Signup error:", error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        return res
            .status(500)
            .json({ error: "Signup failed", detail: error?.message });
    }
};
exports.signup = signup;
const adminSignup = async (req, res) => {
    try {
        const { email, password } = adminSignupSchema.parse(req.body);
        // Check if email is in admin whitelist
        const whitelisted = await prisma_1.prisma.adminWhitelist.findUnique({
            where: { email },
        });
        if (!whitelisted) {
            return res.status(403).json({
                error: "Unauthorized. This email is not authorized for admin registration.",
            });
        }
        const existingUser = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (existingUser)
            return res.status(400).json({ error: "User already exists" });
        const hashedPassword = await bcrypt_1.default.hash(password, 10);
        await prisma_1.prisma.user.create({
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
    }
    catch (error) {
        console.error("Admin signup error:", error);
        if (error instanceof zod_1.z.ZodError) {
            return res.status(400).json({ error: error.errors });
        }
        return res
            .status(500)
            .json({ error: "Admin signup failed", detail: error?.message });
    }
};
exports.adminSignup = adminSignup;
const verifyEmail = async (req, res) => {
    try {
        const { email, code } = verifyEmailSchema.parse(req.body);
        const validOtp = await prisma_1.prisma.otp.findFirst({
            where: { email, code, expiresAt: { gt: new Date() } },
        });
        if (!validOtp)
            return res.status(400).json({ error: "Invalid or expired OTP" });
        await prisma_1.prisma.user.update({
            where: { email },
            data: { isVerified: true },
        });
        await prisma_1.prisma.otp.delete({ where: { id: validOtp.id } });
        // Auto-login? Or ask to login.
        res.json({ message: "Email verified. You can now login." });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: "Verification failed" });
    }
};
exports.verifyEmail = verifyEmail;
const login = async (req, res) => {
    try {
        const { email, password } = loginSchema.parse(req.body);
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user || !user.password)
            return res.status(400).json({ error: "Invalid credentials" });
        const validPass = await bcrypt_1.default.compare(password, user.password);
        if (!validPass)
            return res.status(400).json({ error: "Invalid credentials" });
        if (!user.isVerified)
            return res.status(403).json({ error: "Email not verified" });
        // Enhanced admin security: verify admin users are still whitelisted
        if (user.role === "ADMIN") {
            const whitelisted = await prisma_1.prisma.adminWhitelist.findUnique({
                where: { email },
            });
            if (!whitelisted) {
                return res.status(403).json({
                    error: "Unauthorized. Admin access has been revoked.",
                });
            }
        }
        const { accessToken, refreshToken } = (0, token_1.generateTokens)(user.id, user.role, user.tokenVersion);
        res.json({ accessToken, refreshToken });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: "Login failed" });
    }
};
exports.login = login;
const forgotPassword = async (req, res) => {
    try {
        const { email } = forgotPasswordSchema.parse(req.body);
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user)
            return res.status(404).json({ error: "User not found" });
        await generateAndSendOtp(email);
        res.json({ message: "OTP sent for password reset" });
    }
    catch (error) {
        res.status(500).json({ error: "Request failed" });
    }
};
exports.forgotPassword = forgotPassword;
const resetPassword = async (req, res) => {
    try {
        const { email, code, newPassword } = resetPasswordSchema.parse(req.body);
        const validOtp = await prisma_1.prisma.otp.findFirst({
            where: { email, code, expiresAt: { gt: new Date() } },
        });
        if (!validOtp)
            return res.status(400).json({ error: "Invalid or expired OTP" });
        const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
        await prisma_1.prisma.user.update({
            where: { email },
            data: {
                password: hashedPassword,
                tokenVersion: { increment: 1 }, // 🔥 invalidate all sessions
            },
        });
        await prisma_1.prisma.otp.delete({ where: { id: validOtp.id } });
        res.json({ message: "Password reset successful" });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: "Reset failed" });
    }
};
exports.resetPassword = resetPassword;
// Keep requestOtp for backward compatibility if needed, or remove.
const resendOtp = async (req, res) => {
    try {
        const { email } = forgotPasswordSchema.parse(req.body); // Reuse simple email schema
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user)
            return res.status(404).json({ error: "User not found" });
        await generateAndSendOtp(email);
        res.json({ message: "OTP resent successfully" });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError)
            return res.status(400).json({ error: error.errors });
        res.status(500).json({ error: "Resend OTP failed" });
    }
};
exports.resendOtp = resendOtp;
const logout = async (_req, res) => {
    // 🔐 Logout is client-side:
    // - frontend deletes accessToken
    // - frontend deletes refreshToken
    return res.status(200).json({
        message: "Logged out successfully",
    });
};
exports.logout = logout;
const getMe = async (req, res) => {
    try {
        const userId = req.user?.userId;
        if (!userId)
            return res.status(401).json({ error: "Unauthorized" });
        // include related data you want to expose
        const user = await prisma_1.prisma.user.findUnique({
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
        if (!user)
            return res.status(404).json({ error: "User not found" });
        // Remove sensitive fields before sending
        // (password is optional in your schema but remove if present)
        const { password, ...sanitized } = user;
        return res.json(sanitized);
    }
    catch (error) {
        console.error("getMe error:", error);
        return res.status(500).json({ error: "Failed to fetch user" });
    }
};
exports.getMe = getMe;
const updateMe = async (req, res) => {
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
        const updatedUser = await prisma_1.prisma.user.update({
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
        const { password, ...sanitized } = updatedUser;
        return res.json(sanitized);
    }
    catch (error) {
        console.error("updateMe error:", error);
        return res.status(500).json({ error: "Failed to update user" });
    }
};
exports.updateMe = updateMe;
const forceChangePassword = async (req, res) => {
    try {
        const { email, newPassword } = req.body;
        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({
                error: "Password must be at least 8 characters",
            });
        }
        const user = await prisma_1.prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        const hashedPassword = await bcrypt_1.default.hash(newPassword, 10);
        await prisma_1.prisma.user.update({
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
    }
    catch (error) {
        console.error("forceChangePassword error:", error);
        return res.status(500).json({ error: "Password reset failed" });
    }
};
exports.forceChangePassword = forceChangePassword;
