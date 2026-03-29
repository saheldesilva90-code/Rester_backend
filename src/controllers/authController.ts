import { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import {
    createUser,
    getUserByEmail,
    updateRefreshToken,
    updatePushToken,
    getUserById,
    updateUser,
} from "../db/queries";
import { sendVerificationEmail, sendLoginOTPEmail } from "../lib/mailer";
import { authenticator } from "otplib";
import QRCode from "qrcode";

const generateAccessToken = (userId: string) => {
    return jwt.sign({ userId }, ENV.JWT_SECRET, { expiresIn: "1y" });
};

const generateRefreshToken = (userId: string) => {
    return jwt.sign({ userId }, ENV.JWT_REFRESH_SECRET, { expiresIn: "1y" });
};

export const register = async (req: Request, res: Response) => {
    try {
        const { name, email, password, pushToken } = req.body;

        if (!name || !email || !password) {
            res.status(400).json({ success: false, message: "Name, email and password are required" });
            return;
        }

        const existingUser = await getUserByEmail(email);
        if (existingUser) {
            res.status(409).json({ success: false, message: "Email already in use" });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 10);
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
        const verificationCodeExpiry = new Date(Date.now() + 10 * 60 * 1000);

        const user = await createUser({
            name,
            email,
            passwordHash,
            verificationCode,
            verificationCodeExpiry,
            isVerified: false,
        });

        try {
            await sendVerificationEmail(email, verificationCode, name);
        } catch (emailError) {
            console.error("Email send failed:", emailError);
            res.status(500).json({ success: false, message: "Failed to send verification email" });
            return;
        }

        if (pushToken) await updatePushToken(user.id, pushToken);

        res.status(201).json({
            success: true,
            message: "Verification code sent to your email",
            data: { userId: user.id, email: user.email },
        });
    } catch (error) {
        console.error("Register error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const verifyEmail = async (req: Request, res: Response) => {
    try {
        const { userId, code } = req.body;

        if (!userId || !code) {
            res.status(400).json({ success: false, message: "userId and code are required" });
            return;
        }

        const user = await getUserById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        if (!user.verificationCode) {
            res.status(400).json({ success: false, message: "No verification code found. Please register again." });
            return;
        }

        if (user.verificationCode !== code) {
            res.status(400).json({ success: false, message: "Invalid verification code" });
            return;
        }

        if (!user.verificationCodeExpiry || user.verificationCodeExpiry < new Date()) {
            res.status(400).json({ success: false, message: "Verification code has expired" });
            return;
        }

        await updateUser(userId, {
            isVerified: true,
            verificationCode: null,
            verificationCodeExpiry: null,
        });

        const accessToken = generateAccessToken(userId);
        const refreshToken = generateRefreshToken(userId);
        await updateRefreshToken(userId, refreshToken);

        const { passwordHash: _, refreshToken: __, verificationCode: ___, verificationCodeExpiry: ____, ...safeUser } = user;

        res.status(200).json({
            success: true,
            data: {
                user: { ...safeUser, isVerified: true },
                accessToken,
                refreshToken,
            },
        });
    } catch (error) {
        console.error("Verify email error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const setup2FA = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const user = await getUserById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        const secret = authenticator.generateSecret();
        const otpAuthUrl = authenticator.keyuri(user.email, "Rester", secret);
        const qrCodeDataUrl = await QRCode.toDataURL(otpAuthUrl);

        await updateUser(userId, { twoFactorSecret: secret });

        res.status(200).json({
            success: true,
            data: { secret, qrCodeDataUrl },
        });
    } catch (error) {
        console.error("2FA setup error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const verify2FA = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const { code } = req.body;

        if (!code) {
            res.status(400).json({ success: false, message: "Code is required" });
            return;
        }

        const user = await getUserById(userId);
        if (!user || !user.twoFactorSecret) {
            res.status(400).json({ success: false, message: "2FA not set up" });
            return;
        }

        const isValid = authenticator.verify({ token: code, secret: user.twoFactorSecret });
        if (!isValid) {
            res.status(400).json({ success: false, message: "Invalid code" });
            return;
        }

        await updateUser(userId, { twoFactorEnabled: true });

        res.status(200).json({ success: true, message: "2FA enabled successfully" });
    } catch (error) {
        console.error("2FA verify error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const sendLoginOTP = async (req: Request, res: Response) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            res.status(400).json({ success: false, message: "Email and password are required" });
            return;
        }

        const user = await getUserByEmail(email);
        if (!user) {
            // Don't reveal if email exists
            res.status(200).json({ success: true, message: "If that email exists, a code was sent." });
            return;
        }

        if (!user.isVerified) {
            res.status(401).json({ success: false, message: "Please verify your email first" });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            res.status(401).json({ success: false, message: "Invalid credentials" });
            return;
        }

        const loginOTP = Math.floor(100000 + Math.random() * 900000).toString();
        const loginOTPExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        await updateUser(user.id, { loginOTP, loginOTPExpiry });

        await sendLoginOTPEmail(user.email, loginOTP, user.name);

        res.status(200).json({
            success: true,
            message: "Login code sent to your email",
            data: {
                requiresTwoFactor: user.twoFactorEnabled,
            },
        });
    } catch (error) {
        console.error("Send login OTP error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const verifyLoginOTP = async (req: Request, res: Response) => {
    try {
        const { email, loginOTP, twoFactorCode, pushToken } = req.body;

        if (!email || !loginOTP) {
            res.status(400).json({ success: false, message: "Email and OTP are required" });
            return;
        }

        const user = await getUserByEmail(email);
        if (!user) {
            res.status(401).json({ success: false, message: "Invalid credentials" });
            return;
        }

        if (!user.loginOTP || user.loginOTP !== loginOTP) {
            res.status(401).json({ success: false, message: "Invalid login code" });
            return;
        }

        if (!user.loginOTPExpiry || user.loginOTPExpiry < new Date()) {
            res.status(401).json({ success: false, message: "Login code has expired" });
            return;
        }

        if (user.twoFactorEnabled) {
            if (!twoFactorCode) {
                res.status(400).json({ success: false, message: "2FA code is required" });
                return;
            }
            const isValid = authenticator.verify({ token: twoFactorCode, secret: user.twoFactorSecret! });
            if (!isValid) {
                res.status(401).json({ success: false, message: "Invalid 2FA code" });
                return;
            }
        }

        // Clear OTP after successful use
        await updateUser(user.id, { loginOTP: null, loginOTPExpiry: null });

        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        await updateRefreshToken(user.id, refreshToken);
        if (pushToken) await updatePushToken(user.id, pushToken);

        const { passwordHash: _, refreshToken: __, verificationCode: ___, verificationCodeExpiry: ____, twoFactorSecret: _____, loginOTP: ______, loginOTPExpiry: _______, ...safeUser } = user;

        res.status(200).json({
            success: true,
            data: { user: safeUser, accessToken, refreshToken },
        });
    } catch (error) {
        console.error("Verify login OTP error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password, pushToken, twoFactorCode } = req.body;

        if (!email || !password) {
            res.status(400).json({ success: false, message: "Email and password are required" });
            return;
        }

        const user = await getUserByEmail(email);
        if (!user) {
            res.status(401).json({ success: false, message: "Invalid credentials" });
            return;
        }

        if (!user.isVerified) {
            res.status(401).json({ success: false, message: "Please verify your email first" });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            res.status(401).json({ success: false, message: "Invalid credentials" });
            return;
        }

        if (user.twoFactorEnabled) {
            if (!twoFactorCode) {
                res.status(200).json({ success: true, data: { requiresTwoFactor: true } });
                return;
            }
            const isValid = authenticator.verify({ token: twoFactorCode, secret: user.twoFactorSecret! });
            if (!isValid) {
                res.status(401).json({ success: false, message: "Invalid 2FA code" });
                return;
            }
        }

        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        await updateRefreshToken(user.id, refreshToken);
        if (pushToken) await updatePushToken(user.id, pushToken);

        const { passwordHash: _, refreshToken: __, verificationCode: ___, verificationCodeExpiry: ____, twoFactorSecret: _____, ...safeUser } = user;

        res.status(200).json({
            success: true,
            data: { user: safeUser, accessToken, refreshToken },
        });
    } catch (error) {
        console.error("Login error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const logout = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;

        await updateRefreshToken(userId, null);
        await updatePushToken(userId, null);

        res.status(200).json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const refreshToken = async (req: Request, res: Response) => {
    try {
        const { refreshToken } = req.body;

        if (!refreshToken) {
            res.status(400).json({ success: false, message: "Refresh token is required" });
            return;
        }

        const decoded = jwt.verify(refreshToken, ENV.JWT_REFRESH_SECRET) as { userId: string };

        const user = await getUserById(decoded.userId);
        if (!user || user.refreshToken !== refreshToken) {
            res.status(401).json({ success: false, message: "Invalid refresh token" });
            return;
        }

        const newAccessToken = generateAccessToken(user.id);
        const newRefreshToken = generateRefreshToken(user.id);

        await updateRefreshToken(user.id, newRefreshToken);

        res.status(200).json({
            success: true,
            data: { accessToken: newAccessToken, refreshToken: newRefreshToken },
        });
    } catch (error) {
        console.error("Refresh token error:", error);
        res.status(401).json({ success: false, message: "Invalid or expired refresh token" });
    }
};