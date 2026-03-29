import { Router } from "express";
import { register, login, logout, refreshToken, verifyEmail, setup2FA, verify2FA } from "../controllers/authController";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authMiddleware, logout);
router.post("/verify-email", verifyEmail);
router.post("/refresh-token", refreshToken);
router.post("/2fa/setup", authMiddleware, setup2FA);
router.post("/2fa/verify", authMiddleware, verify2FA);

export default router;