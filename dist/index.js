"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const app_1 = __importDefault(require("./app"));
const dotenv_1 = __importDefault(require("dotenv"));
const http_1 = __importDefault(require("http"));
// import { startSchedulers } from "./services/scheduler";
const websocket_1 = require("./websocket");
const wsPriceFeed_1 = require("./services/wsPriceFeed");
// import { startBybitFeed } from "./services/wsPriceFeed";
// import 
dotenv_1.default.config();
const PORT = process.env.PORT || 5000;
// Create HTTP server
const server = http_1.default.createServer(app_1.default);
// Start WebSocket server
(0, websocket_1.startSocketServer)(server);
// Start scheduled tasks
// startSchedulers();
// Start realtime Binance feed
(0, wsPriceFeed_1.startBinanceFeed)();
app_1.default.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/api-docs`);
});
app_1.default.get("/health", (_, res) => {
    res.status(200).json({ status: "ok" });
});
