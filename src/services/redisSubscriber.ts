import { createClient, RedisClientType } from "redis";
import EventEmitter from "events";

export const marketEvents = new EventEmitter();

const redis = createClient({
  url: process.env.REDIS_URL
});

redis.on("error", (err: Error) => {
  console.error("❌ Redis error (api)", err);
});

async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }
}

connectRedis();

redis.subscribe("priceUpdate", (message: string) => {
  marketEvents.emit("priceUpdate", JSON.parse(message));
});

redis.subscribe("klineUpdate", (message: string) => {
  marketEvents.emit("klineUpdate", JSON.parse(message));
});
