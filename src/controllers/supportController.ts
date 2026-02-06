import { Response } from "express";
import { prisma } from "../utils/prisma";
import { AuthRequest } from "../middlewares/authMiddleware";

export const getTickets = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const tickets = await prisma.supportTicket.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch tickets" });
  }
};

export const getAllTickets = async (req: AuthRequest, res: Response) => {
  try {
    const tickets = await prisma.supportTicket.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            fullName: true,
          },
        },
      },
    });
    res.json({ success: true, tickets });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch all tickets" });
  }
};

export const createTicket = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { subject, message } = req.body;

    const ticket = await prisma.supportTicket.create({
      data: {
        userId,
        subject,
        message,
        status: "open",
      },
    });

    res.status(201).json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ error: "Failed to create ticket" });
  }
};

export const replyTicket = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { adminReply, status } = req.body;
    const adminId = req.user!.userId;

    const ticket = await prisma.supportTicket.update({
      where: { id },
      data: {
        adminReply,
        adminId,
        status: status || "open",
      },
    });

    res.json({ success: true, ticket });
  } catch (error) {
    res.status(500).json({ error: "Failed to reply to ticket" });
  }
};
