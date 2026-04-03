import { Request, Response } from "express";
import { db } from "../db";
import { friends } from "../db/schema";
import { and, eq, or } from "drizzle-orm";

export const removeFriend = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const friendId = String(req.params.friendId);

        await db.delete(friends).where(
            or(
                and(eq(friends.userId, currentUserId), eq(friends.friendId, friendId)),
                and(eq(friends.userId, friendId), eq(friends.friendId, currentUserId))
            )
        );

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("removeFriend error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};