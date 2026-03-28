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
import { sendVerificationEmail } from "../lib/mailer";

const generateAccessToken = (userId: string) => {
    return jwt.sign({ userId }, ENV.JWT_SECRET, { expiresIn: "15m" });
};

const generateRefreshToken = (userId: string) => {
    return jwt.sign({ userId }, ENV.JWT_REFRESH_SECRET, { expiresIn: "7d" });
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
        const verificationCodeExpiry = new Date(Date.now() + 10 * 60 * 1000); // 10 mins

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
            res.status(400).json({ success: false, message: "User ID and code are required" });
            return;
        }

        const user = await getUserById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        if (user.isVerified) {
            res.status(400).json({ success: false, message: "Email already verified" });
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

        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);
        await updateRefreshToken(user.id, refreshToken);

        const { passwordHash: _, refreshToken: __, verificationCode: ___, ...safeUser } = user;

        res.status(200).json({
            success: true,
            message: "Email verified successfully",
            data: { user: safeUser, accessToken, refreshToken },
        });
    } catch (error) {
        console.error("Verify email error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const login = async (req: Request, res: Response) => {
    try {
        const { email, password, pushToken } = req.body;

        if (!email || !password) {
            res.status(400).json({ success: false, message: "Email and password are required" });
            return;
        }

        const user = await getUserByEmail(email);
        if (!user) {
            res.status(401).json({ success: false, message: "Invalid credentials" });
            return;
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
            res.status(401).json({ success: false, message: "Invalid credentials" });
            return;
        }

        const accessToken = generateAccessToken(user.id);
        const refreshToken = generateRefreshToken(user.id);

        await updateRefreshToken(user.id, refreshToken);

        if (pushToken) {
            await updatePushToken(user.id, pushToken);
        }

        const { passwordHash: _, refreshToken: __, ...safeUser } = user;

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