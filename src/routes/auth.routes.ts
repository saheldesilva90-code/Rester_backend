import { Router } from "express";
import { authRateLimit, authSlowDown, twoFactorRateLimit } from "../middleware/rate-limit.middleware";
import { login, register, verifyEmail, setup2FA, verify2FA, logout, refreshToken, sendLoginOTP, verifyLoginOTP } from "../controllers/authController";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.post("/register", authRateLimit, authSlowDown, register);
router.post("/verify-email", authRateLimit, verifyEmail);
router.post("/login", authRateLimit, authSlowDown, login);
router.post("/login/send-otp", authRateLimit, authSlowDown, sendLoginOTP);
router.post("/login/verify-otp", authRateLimit, authSlowDown, verifyLoginOTP);
router.post("/2fa/setup", authMiddleware, setup2FA);
router.post("/2fa/verify", authMiddleware, twoFactorRateLimit, verify2FA);
router.post("/logout", authMiddleware, logout);
router.post("/refresh-token", authRateLimit, refreshToken);

export default router;