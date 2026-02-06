import { Server } from "socket.io";
import { fetchPrices } from "../services/marketPriceService";

const REFRESH_INTERVAL_MS = 15_000; // 5s or 10s depending on how “live” you want

export function initPriceRefresher(io: Server) {
  const tick = async () => {
    try {
      const prices = await fetchPrices(); // force refresh
      // Broadcast to everyone
      io.emit("prices:update", prices);
    } catch (err) {
      console.error("Price refresher error:", err);
    }
  };

  // Run once at start, then at interval
  void tick();
  setInterval(tick, REFRESH_INTERVAL_MS);
}
