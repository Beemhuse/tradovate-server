"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setCachedMarket = exports.getCachedMarket = void 0;
const marketCache = new Map();
const getCachedMarket = (key) => {
    const cached = marketCache.get(key);
    if (!cached)
        return null;
    if (Date.now() > cached.expires) {
        marketCache.delete(key);
        return null;
    }
    return cached.data;
};
exports.getCachedMarket = getCachedMarket;
const setCachedMarket = (key, data, ttlSeconds = 60) => {
    marketCache.set(key, {
        data,
        expires: Date.now() + ttlSeconds * 1000,
    });
};
exports.setCachedMarket = setCachedMarket;
