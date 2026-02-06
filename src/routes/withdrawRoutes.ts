import express from "express";
import { requestBankWithdraw } from "../controllers/withdrawController";
import { authenticateToken } from "../middlewares/authMiddleware";

const router = express.Router();

router.post("/withdraw/bank", authenticateToken, requestBankWithdraw);

export default router;
