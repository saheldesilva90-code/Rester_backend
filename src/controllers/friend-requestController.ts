import { db } from "../db";
import { checkFriendship } from "../db/queries";
import { users } from "../db/schema";
import { Request, Response } from "express";

export const getFriendStatus = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const otherUserId = String(req.params.userId);

        const friendship = await checkFriendship(currentUserId, otherUserId);
        if (friendship) {
            res.status(200).json({ success: true, data: { status: "friends" } });
            return;
        }

        const request = await db.query.friendRequests.findFirst({
            where: (fr, { or, and, eq }) => or(
                and(eq(fr.senderId, currentUserId), eq(fr.receiverId, otherUserId)),
                and(eq(fr.senderId, otherUserId), eq(fr.receiverId, currentUserId))
            ),
        });

        if (!request) {
            res.status(200).json({ success: true, data: { status: "none" } });
            return;
        }

        if (request.status === "pending") {
            const status = request.senderId === currentUserId ? "pending_sent" : "pending_received";
            res.status(200).json({ success: true, data: { status, requestId: request.id } });
            return;
        }

        res.status(200).json({ success: true, data: { status: "none" } });
    } catch (error) {
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};