"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initPriceRefresher = initPriceRefresher;
const marketPriceService_1 = require("../services/marketPriceService");
const REFRESH_INTERVAL_MS = 15000; // 5s or 10s depending on how “live” you want
function initPriceRefresher(io) {
    const tick = async () => {
        try {
            const prices = await (0, marketPriceService_1.fetchPrices)(); // force refresh
            // Broadcast to everyone
            io.emit("prices:update", prices);
        }
        catch (err) {
            console.error("Price refresher error:", err);
        }
    };
    // Run once at start, then at interval
    void tick();
    setInterval(tick, REFRESH_INTERVAL_MS);
}
