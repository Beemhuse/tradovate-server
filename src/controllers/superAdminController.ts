import { Request, Response } from "express";
import { prisma } from "../utils/prisma";
import bcrypt from "bcrypt";
import { z } from "zod";

const createAdminSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  fullName: z.string().optional(),
  businessName: z.string().min(2),
});

export const createAdmin = async (req: Request, res: Response) => {
  try {
    const { email, password, fullName, businessName } = createAdminSchema.parse(
      req.body,
    );

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res
        .status(400)
        .json({ error: "User with this email already exists" });
    }

    const existingBusiness = await prisma.business.findUnique({
      where: { name: businessName },
    });
    if (existingBusiness) {
      return res
        .status(400)
        .json({ error: "Business with this name already exists" });
    }

    // Transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      const hashedPassword = await bcrypt.hash(password, 10);

      // 1. Create User
      const newUser = await tx.user.create({
        data: {
          email,
          password: hashedPassword,
          fullName,
          role: "ADMIN",
          isVerified: true, // Auto-verify admin created by super admin?
        },
      });

      // 2. Create Business
      const newBusiness = await tx.business.create({
        data: {
          name: businessName,
          ownerId: newUser.id,
        },
      });

      // 3. Link User to Business (as owner/member)
      // Note: ownerId is already set on Business, but we also want businessId on User
      await tx.user.update({
        where: { id: newUser.id },
        data: { businessId: newBusiness.id },
      });

      return { user: newUser, business: newBusiness };
    });

    res.json({
      message: "Admin and Business created successfully",
      data: result,
    });
  } catch (error: any) {
    console.error("Create Admin Error:", error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: "Failed to create admin" });
  }
};

export const getAllAdmins = async (req: Request, res: Response) => {
  try {
    const admins = await prisma.user.findMany({
      where: { role: "ADMIN" },
      include: {
        ownedBusiness: true,
      },
    });
    res.json(admins);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch admins" });
  }
};

export const getSystemStats = async (req: Request, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalBusinesses = await prisma.business.count();
    // Add more stats as needed
    res.json({ totalUsers, totalBusinesses });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch stats" });
  }
};
