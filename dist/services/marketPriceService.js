"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.klineEvents = exports.priceEvents = void 0;
exports.fetchPrices = fetchPrices;
exports.updatePrice = updatePrice;
exports.getMarketPriceForCoin = getMarketPriceForCoin;
exports.getPriceByCoinSymbol = getPriceByCoinSymbol;
exports.updateKline = updateKline;
// import axios from 'axios';
const prisma_1 = require("../utils/prisma");
const axios_1 = __importDefault(require("axios"));
const events_1 = require("events");
exports.priceEvents = new events_1.EventEmitter();
const CACHE_TTL = 8000;
let lastUpdated = 0;
let priceCache = {};
const COIN_MAP = {
    BTC: "bitcoin",
    ETH: "ethereum",
    XRP: "ripple",
    DOGE: "dogecoin",
    BCH: "bitcoin-cash",
    LTC: "litecoin",
    TRX: "tron",
    FIL: "filecoin",
};
async function fetchPrices() {
    const now = Date.now();
    if (now - lastUpdated < CACHE_TTL)
        return priceCache;
    const ids = Object.values(COIN_MAP).join(",");
    const url = `https://api.coingecko.com/api/v3/simple/price`;
    const { data } = await axios_1.default.get(url, {
        params: {
            ids,
            vs_currencies: "usd",
            include_24hr_change: true,
        },
    });
    const formatted = {};
    Object.entries(COIN_MAP).forEach(([symbol, cgId]) => {
        if (data[cgId]) {
            formatted[symbol] = {
                symbol,
                price: data[cgId].usd,
                change24h: data[cgId].usd_24h_change,
            };
        }
    });
    priceCache = formatted;
    lastUpdated = now;
    return formatted;
}
// Called by WebSocket price feed (real-time)
function updatePrice(symbol, price, change24h) {
    if (!priceCache[symbol])
        return;
    priceCache[symbol].price = price;
    if (change24h !== undefined) {
        priceCache[symbol].change24h = change24h;
    }
    exports.priceEvents.emit("priceUpdate", {
        symbol,
        price,
        change24h: priceCache[symbol].change24h,
    });
}
async function getMarketPriceForCoin(coinId) {
    const coin = await prisma_1.prisma.coin.findUnique({
        where: { id: coinId },
    });
    if (!coin)
        return null;
    const prices = await fetchPrices();
    return prices[coin.symbol] || null;
}
// Helper to get price by symbol
async function getPriceByCoinSymbol(symbol) {
    const prices = await fetchPrices();
    return prices[symbol]?.price || null;
}
exports.klineEvents = new events_1.EventEmitter();
function updateKline(kline) {
    exports.klineEvents.emit("klineUpdate", kline);
}
