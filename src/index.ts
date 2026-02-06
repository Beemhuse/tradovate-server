import app from "./app";
import dotenv from "dotenv";
import http from "http";
// import { startSchedulers } from "./services/scheduler";
import { startSocketServer } from "./websocket";
import { startBinanceFeed } from "./services/wsPriceFeed";
import { startCronJobs } from "./cron";

startCronJobs();

// import { startBybitFeed } from "./services/wsPriceFeed";
// import
dotenv.config();

const PORT = process.env.PORT || 5000;
// Create HTTP server
const server = http.createServer(app);

// Start WebSocket server
startSocketServer(server);

// Start scheduled tasks
// startSchedulers();

// Start realtime Binance feed
startBinanceFeed();

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});

app.get("/health", (_, res) => {
  res.status(200).json({ status: "ok" });
});
