import WebSocket from "ws";
import { updatePrice } from "./marketPriceService";

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

export function startBinanceFeed() {
  const ws = new WebSocket(
  "wss://nameless-leaf-1705.brightawah94.workers.dev/stream?streams=btcusdt@miniTicker"
);

  ws.on("open", () => {
    console.log("✓ Binance WebSocket Connected");
  });

  ws.on("message", (msg) => {
    const payload = JSON.parse(msg.toString());
    const data = payload.data;

    if (!data) return;

    const symbol = data.s.replace("USDT", ""); // "BTCUSDT" → "BTC"
    const price = parseFloat(data.c);

    updatePrice(symbol, price);
  });

  ws.on("error", (err) => {
    console.log("⚠ Binance WS Error:", err.message);
  });

  ws.on("close", () => {
    console.log("✗ Binance WS Disconnected. Reconnecting...");
    setTimeout(startBinanceFeed, 1500);
  });
}
