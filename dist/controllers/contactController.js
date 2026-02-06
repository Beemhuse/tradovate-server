"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateContactInfo = exports.getContactInfo = void 0;
const prisma_1 = require("../utils/prisma");
/* =========================================
   GET CONTACT INFO (Public)
========================================= */
const getContactInfo = async (req, res) => {
    try {
        // Fetch the first record (singleton pattern)
        const contact = await prisma_1.prisma.contactInfo.findFirst();
        return res.json(contact || {});
    }
    catch (error) {
        console.error("Error fetching contact info:", error);
        return res.status(500).json({ error: "Failed to fetch contact info" });
    }
};
exports.getContactInfo = getContactInfo;
/* =========================================
   UPDATE CONTACT INFO (Admin)
========================================= */
const updateContactInfo = async (req, res) => {
    try {
        const { email, phone, whatsapp, address } = req.body;
        // Check if a record exists
        const existing = await prisma_1.prisma.contactInfo.findFirst();
        let contact;
        if (existing) {
            contact = await prisma_1.prisma.contactInfo.update({
                where: { id: existing.id },
                data: { email, phone, whatsapp, address },
            });
        }
        else {
            contact = await prisma_1.prisma.contactInfo.create({
                data: { email, phone, whatsapp, address },
            });
        }
        return res.json({ message: "Contact info updated", contact });
    }
    catch (error) {
        console.error("Error updating contact info:", error);
        return res.status(500).json({ error: "Failed to update contact info" });
    }
};
exports.updateContactInfo = updateContactInfo;
