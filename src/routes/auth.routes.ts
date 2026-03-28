import { Router } from "express";
import { register, login, logout, refreshToken } from "../controllers/authController";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authMiddleware, logout);
router.post("/refresh-token", refreshToken);

export default router;