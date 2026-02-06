"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startBinanceFeed = startBinanceFeed;
const ws_1 = __importDefault(require("ws"));
const marketPriceService_1 = require("./marketPriceService");
const STREAMS = [
    "btcusdt@miniTicker",
    "ethusdt@miniTicker",
    "xrpusdt@miniTicker",
    "dogeusdt@miniTicker",
    "bchusdt@miniTicker",
    "ltcusdt@miniTicker",
    "trxusdt@miniTicker",
    "filusdt@miniTicker",
];
function startBinanceFeed() {
    const ws = new ws_1.default("wss://nameless-leaf-1705.brightawah94.workers.dev/stream?streams=btcusdt@miniTicker");
    ws.on("open", () => {
        console.log("✓ Binance WebSocket Connected");
    });
    ws.on("message", (msg) => {
        const payload = JSON.parse(msg.toString());
        const data = payload.data;
        if (!data)
            return;
        const symbol = data.s.replace("USDT", ""); // "BTCUSDT" → "BTC"
        const price = parseFloat(data.c);
        (0, marketPriceService_1.updatePrice)(symbol, price);
    });
    ws.on("error", (err) => {
        console.log("⚠ Binance WS Error:", err.message);
    });
    ws.on("close", () => {
        console.log("✗ Binance WS Disconnected. Reconnecting...");
        setTimeout(startBinanceFeed, 1500);
    });
}
