"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.startSchedulers = startSchedulers;
const node_cron_1 = __importDefault(require("node-cron"));
const marketPriceService_1 = require("./marketPriceService");
function startSchedulers() {
    console.log("✓ Schedulers running...");
    node_cron_1.default.schedule("*/15 * * * * *", async () => {
        await (0, marketPriceService_1.fetchPrices)();
    });
}
