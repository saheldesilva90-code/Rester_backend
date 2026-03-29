import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { getMe, updateMe } from "../controllers/userController";

const router = Router();

router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateMe);

export default router;