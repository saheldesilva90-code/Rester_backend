import { Request, Response } from "express";
import { updateUser, getUserById } from "../db/queries";
import { db } from "../db";
import { users } from "../db/schema";
import { ilike } from "drizzle-orm";

export const updateMe = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const { name, imageUrl, gender, dateOfBirth, isOnboarded, pushToken } = req.body;

        const updated = await updateUser(userId, {
            ...(name !== undefined && { name }),
            ...(imageUrl !== undefined && { imageUrl }),
            ...(gender !== undefined && { gender }),
            ...(dateOfBirth !== undefined && { dateOfBirth }),
            ...(isOnboarded !== undefined && { isOnboarded }),
            ...(pushToken !== undefined && { pushToken }),
        });

        const { passwordHash: _, refreshToken: __, verificationCode: ___, verificationCodeExpiry: ____, ...safeUser } = updated;

        res.status(200).json({ success: true, data: { user: safeUser } });
    } catch (error) {
        console.error("Update user error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMe = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const user = await getUserById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }

        const { passwordHash: _, refreshToken: __, verificationCode: ___, verificationCodeExpiry: ____, twoFactorSecret: _____, ...safeUser } = user;

        res.status(200).json({ success: true, data: { user: safeUser } });
    } catch (error) {
        console.error("Get me error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const searchUsers = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const q = (req.query.q as string ?? "").trim();

        if (!q) {
            return res.status(200).json({ success: true, data: { users: [] } });
        }

        const results = await db
            .select({
                id: users.id,
                name: users.name,
                imageUrl: users.imageUrl,
                isOnline: users.isOnline,
            })
            .from(users)
            .where(ilike(users.name, `%${q}%`))
            .limit(20);

        const filtered = results.filter((u) => u.id !== currentUserId);

        return res.status(200).json({ success: true, data: { users: filtered } });
    } catch (error) {
        console.error("Search users error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUserProfile = async (req: Request, res: Response) => {
    try {
        const userId = String(req.params.userId);
        const user = await getUserById(userId);
        if (!user) {
            res.status(404).json({ success: false, message: "User not found" });
            return;
        }
        const { passwordHash: _, refreshToken: __, verificationCode: ___, verificationCodeExpiry: ____, twoFactorSecret: _____, ...safeUser } = user;
        res.status(200).json({ success: true, data: { user: safeUser } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};