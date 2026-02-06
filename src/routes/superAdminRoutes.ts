import { Router } from "express";
import {
  createAdmin,
  getAllAdmins,
  getSystemStats,
} from "../controllers/superAdminController";
// import { authenticate, requireSuperAdmin } from "../middlewares/auth"; // You'll need to implement/import this

const router = Router();

// TODO: Add authentication middleware
// router.use(authenticate);
// router.use(requireSuperAdmin);

router.post("/admins", createAdmin);
router.get("/admins", getAllAdmins);
router.get("/stats", getSystemStats);

export default router;
