"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.prisma = void 0;
const client_1 = require("@prisma/client");
const adapter_pg_1 = require("@prisma/adapter-pg");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const url = process.env.DATABASE_URL;
if (!url)
    throw new Error("DATABASE_URL is missing");
const adapter = new adapter_pg_1.PrismaPg({ connectionString: url });
const _prisma = new client_1.PrismaClient({ adapter });
exports.prisma = process.env.NODE_ENV === "production"
    ? _prisma
    : global.__prisma ?? (global.__prisma = _prisma);
