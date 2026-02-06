import WebSocket, { RawData } from "ws";
import { updateKline } from "./marketPriceService";

export function startBinanceKlineFeed() {
  const intervals = ["1m", "5m", "1h"]; // you can add more
  const symbols = ["btcusdt", "ethusdt", "xrpusdt"];

  const streams = symbols
    .map((s) => intervals.map((i) => `${s}@kline_${i}`))
    .flat()
    .join("/");

  const ws = new WebSocket(
    `wss://nameless-leaf-1705.brightawah94.workers.dev/stream?streams=${streams}`
  );

  ws.on("open", () => console.log("✓ Binance Kline WebSocket Connected"));

  ws.on("message", (msg: RawData) => {
    const payload = JSON.parse(msg.toString());
    const data = payload.data;

    if (!data || !data.k) return;

    const k = data.k; // kline object

    updateKline({
      symbol: k.s.replace("USDT", ""),
      interval: k.i,
      open: parseFloat(k.o),
      high: parseFloat(k.h),
      low: parseFloat(k.l),
      close: parseFloat(k.c),
      volume: parseFloat(k.v),
      isClosed: k.x,
      timestamp: k.t
    });
  });

  ws.on("close", () => {
    console.log("✗ Binance Kline WS Disconnected. Reconnecting...");
    setTimeout(startBinanceKlineFeed, 1500);
  });

  ws.on("error", (err: Error) => {
    console.log("⚠ Binance Kline WS Error:", err.message);
  });
}
