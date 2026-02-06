import cron from "node-cron";
import { fetchPrices } from "./marketPriceService";

export function startSchedulers() {
  console.log("✓ Schedulers running...");

  cron.schedule("*/15 * * * * *", async () => {
    await fetchPrices();
  });
}
