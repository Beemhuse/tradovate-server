"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.N = exports.D = void 0;
const client_1 = require("@prisma/client");
const D = (v) => new client_1.Prisma.Decimal(v);
exports.D = D;
const N = (v) => v ? Number(v) : 0;
exports.N = N;
