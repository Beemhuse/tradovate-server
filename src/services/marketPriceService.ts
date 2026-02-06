// import axios from 'axios';
import { prisma } from "../utils/prisma";

export type MarketPrice = {
  coinId: string;
  symbol: string;
  name: string;
  price: number;
  change24h: number;
};

import axios from "axios";
import { EventEmitter } from "events";

export const priceEvents = new EventEmitter();

const CACHE_TTL = 8000;
let lastUpdated = 0;
let priceCache: any = {};

const COIN_MAP = {
  BTC: "bitcoin",
  ETH: "ethereum",
  XRP: "ripple",
  DOGE: "dogecoin",
  BCH: "bitcoin-cash",
  LTC: "litecoin",
  TRX: "tron",
  FIL: "filecoin",
  USDT: "tether",
  USDC: "usd-coin",
};

export async function fetchPrices() {
  const now = Date.now();
  if (now - lastUpdated < CACHE_TTL) return priceCache;

  const ids = Object.values(COIN_MAP).join(",");

  const url = `https://api.coingecko.com/api/v3/simple/price`;

  try {
    const { data } = await axios.get(url, {
      params: {
        ids,
        vs_currencies: "usd",
        include_24hr_change: true,
      },
      timeout: 5000,
    });
    const formatted: any = {};
    Object.entries(COIN_MAP).forEach(([symbol, cgId]) => {
      if (data[cgId]) {
        formatted[symbol] = {
          symbol,
          price: data[cgId].usd,
          change24h: data[cgId].usd_24h_change || 0,
        };
      }
    });

    priceCache = formatted;
    lastUpdated = now;

    return formatted;
  } catch (error) {
    console.error("fetchPrices error:", error);
    // Return cache if it exists, otherwise empty
    return priceCache;
  }
}

// Called by WebSocket price feed (real-time)
export function updatePrice(symbol: string, price: number, change24h?: number) {
  if (!priceCache[symbol]) return;

  priceCache[symbol].price = price;

  if (change24h !== undefined) {
    priceCache[symbol].change24h = change24h;
  }

  priceEvents.emit("priceUpdate", {
    symbol,
    price,
    change24h: priceCache[symbol].change24h,
  });
}

export async function getMarketPriceForCoin(
  coinId: string,
): Promise<MarketPrice | null> {
  const coin = await prisma.coin.findUnique({
    where: { id: coinId },
  });

  if (!coin) return null;

  const prices = await fetchPrices();
  const priceData = prices[coin.symbol];

  if (priceData) return priceData;

  // Fallback for stablecoins if not in cache
  if (["USDT", "USDC", "BUSD", "DAI"].includes(coin.symbol.toUpperCase())) {
    return {
      coinId: coin.id,
      symbol: coin.symbol,
      name: coin.name,
      price: 1.0,
      change24h: 0,
    };
  }

  return null;
}

// Helper to get price by symbol
export async function getPriceByCoinSymbol(
  symbol: string,
): Promise<number | null> {
  const prices = await fetchPrices();
  const price = prices[symbol]?.price;

  if (price !== undefined) return price;

  // Fallback for stablecoins
  if (["USDT", "USDC", "BUSD", "DAI"].includes(symbol.toUpperCase())) {
    return 1.0;
  }

  return null;
}
export const klineEvents = new EventEmitter();

export function updateKline(kline: {
  symbol: string;
  interval: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  isClosed: boolean;
  timestamp: number;
}) {
  klineEvents.emit("klineUpdate", kline);
}
