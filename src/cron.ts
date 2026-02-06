// cron.ts
import { settleExpiredTrades } from "./jobs/settleExpiredJobs";
import cron from "node-cron";

export const startCronJobs = () => {
  cron.schedule("*/5 * * * * *", async () => {
    try {
      await settleExpiredTrades();
    } catch (err) {
      console.error("[CRON ERROR]", err);
    }
  });

  console.log("✅ Cron jobs started");
};
