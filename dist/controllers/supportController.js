"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.replyTicket = exports.createTicket = exports.getAllTickets = exports.getTickets = void 0;
const prisma_1 = require("../utils/prisma");
const getTickets = async (req, res) => {
    try {
        const userId = req.user.userId;
        const tickets = await prisma_1.prisma.supportTicket.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
        });
        res.json({ success: true, tickets });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch tickets" });
    }
};
exports.getTickets = getTickets;
const getAllTickets = async (req, res) => {
    try {
        const tickets = await prisma_1.prisma.supportTicket.findMany({
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
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch all tickets" });
    }
};
exports.getAllTickets = getAllTickets;
const createTicket = async (req, res) => {
    try {
        const userId = req.user.userId;
        const { subject, message } = req.body;
        const ticket = await prisma_1.prisma.supportTicket.create({
            data: {
                userId,
                subject,
                message,
                status: "open",
            },
        });
        res.status(201).json({ success: true, ticket });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create ticket" });
    }
};
exports.createTicket = createTicket;
const replyTicket = async (req, res) => {
    try {
        const { id } = req.params;
        const { adminReply, status } = req.body;
        const adminId = req.user.userId;
        const ticket = await prisma_1.prisma.supportTicket.update({
            where: { id },
            data: {
                adminReply,
                adminId,
                status: status || "open",
            },
        });
        res.json({ success: true, ticket });
    }
    catch (error) {
        res.status(500).json({ error: "Failed to reply to ticket" });
    }
};
exports.replyTicket = replyTicket;
