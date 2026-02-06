"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSocketServer = startSocketServer;
const socket_io_1 = require("socket.io");
// import { marketEvents } from "../services/redisSubscriber";
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const JWT_SECRET = process.env.JWT_SECRET;
function startSocketServer(httpServer) {
    const io = new socket_io_1.Server(httpServer, {
        cors: { origin: "*" },
    });
    io.use((socket, next) => {
        const token = socket.handshake.auth?.token;
        if (!token)
            return next(new Error("NO_AUTH_TOKEN"));
        try {
            socket.data.user = jsonwebtoken_1.default.verify(token, JWT_SECRET);
            next();
        }
        catch {
            return next(new Error("INVALID_TOKEN"));
        }
    });
    io.on("connection", async (socket) => {
        // OPTIONAL: initial snapshot from Redis / DB
        // const prices = await getLatestPrices();
        // socket.emit("prices:init", prices);
        socket.join(`user:${socket.data.user.id}`);
    });
    // // 🔥 Only Redis-driven events
    // marketEvents.on("priceUpdate", (data) => {
    //   io.emit("priceUpdate", data);
    // });
    // marketEvents.on("klineUpdate", (data) => {
    //   io.emit("klineUpdate", data);
    // });
    return io;
}
