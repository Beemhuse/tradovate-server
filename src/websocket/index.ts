import { Server } from "socket.io";
import { Server as HttpServer } from "http";
// import { marketEvents } from "../services/redisSubscriber";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET!;

export function startSocketServer(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: { origin: "*" },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;

    if (!token) return next(new Error("NO_AUTH_TOKEN"));

    try {
      socket.data.user = jwt.verify(token, JWT_SECRET);
      next();
    } catch {
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
