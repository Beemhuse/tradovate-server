import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config();

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is missing");

const adapter = new PrismaPg({ connectionString: url });

const _prisma = new PrismaClient({ adapter } as any);

declare global {
  var __prisma: PrismaClient | undefined;
}

export const prisma =
  process.env.NODE_ENV === "production"
    ? _prisma
    : global.__prisma ?? (global.__prisma = _prisma);
