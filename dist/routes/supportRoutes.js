"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const authMiddleware_1 = require("../middlewares/authMiddleware");
const supportController_1 = require("../controllers/supportController");
const router = (0, express_1.Router)();
router.use(authMiddleware_1.authenticateToken);
router.get("/", supportController_1.getTickets);
router.post("/", supportController_1.createTicket);
// Admin routes
router.get("/all", (0, authMiddleware_1.requireRole)("ADMIN"), supportController_1.getAllTickets);
router.patch("/:id/reply", (0, authMiddleware_1.requireRole)("ADMIN"), supportController_1.replyTicket);
exports.default = router;
