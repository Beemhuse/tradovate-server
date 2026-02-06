"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.marketEvents = void 0;
const redis_1 = require("redis");
const events_1 = __importDefault(require("events"));
exports.marketEvents = new events_1.default();
const redis = (0, redis_1.createClient)({
    url: process.env.REDIS_URL
});
redis.on("error", (err) => {
    console.error("❌ Redis error (api)", err);
});
async function connectRedis() {
    if (!redis.isOpen) {
        await redis.connect();
    }
}
connectRedis();
redis.subscribe("priceUpdate", (message) => {
    exports.marketEvents.emit("priceUpdate", JSON.parse(message));
});
redis.subscribe("klineUpdate", (message) => {
    exports.marketEvents.emit("klineUpdate", JSON.parse(message));
});
