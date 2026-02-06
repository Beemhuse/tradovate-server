import { Request, Response } from "express";
import { prisma } from "../utils/prisma";

/* =========================================
   GET CONTACT INFO (Public)
========================================= */
export const getContactInfo = async (req: Request, res: Response) => {
  try {
    // Fetch the first record (singleton pattern)
    const contact = await prisma.contactInfo.findFirst();
    return res.json(contact || {});
  } catch (error) {
    console.error("Error fetching contact info:", error);
    return res.status(500).json({ error: "Failed to fetch contact info" });
  }
};

/* =========================================
   UPDATE CONTACT INFO (Admin)
========================================= */
export const updateContactInfo = async (req: Request, res: Response) => {
  try {
    const { email, phone, whatsapp, address } = req.body;

    // Check if a record exists
    const existing = await prisma.contactInfo.findFirst();

    let contact;
    if (existing) {
      contact = await prisma.contactInfo.update({
        where: { id: existing.id },
        data: { email, phone, whatsapp, address },
      });
    } else {
      contact = await prisma.contactInfo.create({
        data: { email, phone, whatsapp, address },
      });
    }

    return res.json({ message: "Contact info updated", contact });
  } catch (error) {
    console.error("Error updating contact info:", error);
    return res.status(500).json({ error: "Failed to update contact info" });
  }
};
