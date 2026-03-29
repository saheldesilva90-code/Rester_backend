import rateLimit from "express-rate-limit";
import slowDown from "express-slow-down";

export const globalRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many requests, please try again later." },
    skipSuccessfulRequests: false,
});

export const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many attempts, please try again later." },
    skipSuccessfulRequests: true,
});

export const authSlowDown = slowDown({
    windowMs: 15 * 60 * 1000,
    delayAfter: 3,
    delayMs: (hits) => hits * 500,
});

export const twoFactorRateLimit = rateLimit({
    windowMs: 10 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, message: "Too many 2FA attempts, please try again later." },
});