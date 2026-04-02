import { eq, and, or } from "drizzle-orm";
import { db } from "../db";
import { checkFriendship } from "../db/queries";
import { friendRequests, friends, users } from "../db/schema";
import { Request, Response } from "express";
import { Expo, ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo();

async function sendPushNotification(
    pushToken: string | null | undefined,
    message: Omit<ExpoPushMessage, "to">
) {
    if (!pushToken || !Expo.isExpoPushToken(pushToken)) return;

    try {
        const chunks = expo.chunkPushNotifications([{ to: pushToken, ...message }]);
        for (const chunk of chunks) {
            const tickets = await expo.sendPushNotificationsAsync(chunk);
            tickets.forEach((ticket) => {
                if (ticket.status === "error") {
                    console.warn("Push notification error:", ticket.message, ticket.details);
                }
            });
        }
    } catch (err) {
        console.warn("sendPushNotification failed:", err);
    }
}

export const getFriendStatus = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const otherUserId = String(req.params.userId);

        const friendship = await checkFriendship(currentUserId, otherUserId);
        if (friendship) {
            return res.status(200).json({
                success: true,
                data: { status: "friends" },
            });
        }

        const request = await db.query.friendRequests.findFirst({
            where: or(
                and(
                    eq(friendRequests.senderId, currentUserId),
                    eq(friendRequests.receiverId, otherUserId)
                ),
                and(
                    eq(friendRequests.senderId, otherUserId),
                    eq(friendRequests.receiverId, currentUserId)
                )
            ),
        });

        if (!request) {
            return res.status(200).json({
                success: true,
                data: { status: "none" },
            });
        }

        if (request.status === "pending") {
            const status =
                request.senderId === currentUserId
                    ? "pending_sent"
                    : "pending_received";

            return res.status(200).json({
                success: true,
                data: { status, requestId: request.id },
            });
        }

        return res.status(200).json({
            success: true,
            data: { status: "none" },
        });
    } catch (error) {
        console.error("getFriendStatus error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const sendFriendRequest = async (req: Request, res: Response) => {
    try {
        const senderId = req.user.id;
        const { receiverId } = req.body;

        if (!receiverId) {
            return res.status(400).json({
                success: false,
                message: "receiverId is required",
            });
        }

        if (senderId === receiverId) {
            return res.status(400).json({
                success: false,
                message: "Cannot send request to yourself",
            });
        }

        const existingFriendship = await checkFriendship(senderId, receiverId);
        if (existingFriendship) {
            return res.status(400).json({
                success: false,
                message: "Already friends",
            });
        }

        const existingRequest = await db.query.friendRequests.findFirst({
            where: or(
                and(
                    eq(friendRequests.senderId, senderId),
                    eq(friendRequests.receiverId, receiverId)
                ),
                and(
                    eq(friendRequests.senderId, receiverId),
                    eq(friendRequests.receiverId, senderId)
                )
            ),
        });

        if (existingRequest) {
            return res.status(400).json({
                success: false,
                message: "Friend request already exists",
            });
        }

        const [sender, receiver] = await Promise.all([
            db.query.users.findFirst({
                where: eq(users.id, senderId),
                columns: { name: true },
            }),
            db.query.users.findFirst({
                where: eq(users.id, receiverId),
                columns: { pushToken: true },
            }),
        ]);

        const [newRequest] = await db
            .insert(friendRequests)
            .values({ senderId, receiverId, status: "pending" })
            .returning();

        sendPushNotification(receiver?.pushToken, {
            title: "New Friend Request",
            body: `${sender?.name ?? "Someone"} sent you a friend request`,
            sound: "default",
            data: {
                type: "FRIEND_REQUEST",
                requestId: newRequest.id,
                senderId,
                senderName: sender?.name ?? "",
            },
        });

        return res.status(201).json({
            success: true,
            data: newRequest,
        });
    } catch (error) {
        console.error("sendFriendRequest error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const cancelFriendRequest = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const requestId = String(req.params.requestId);

        const request = await db.query.friendRequests.findFirst({
            where: eq(friendRequests.id, requestId),
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Friend request not found",
            });
        }

        if (request.senderId !== currentUserId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized",
            });
        }

        await db.delete(friendRequests).where(eq(friendRequests.id, requestId));

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("cancelFriendRequest error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

export const acceptFriendRequest = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const requestId = String(req.params.requestId);

        const request = await db.query.friendRequests.findFirst({
            where: eq(friendRequests.id, requestId),
        });

        if (!request) {
            return res.status(404).json({
                success: false,
                message: "Friend request not found",
            });
        }

        if (request.receiverId !== currentUserId) {
            return res.status(403).json({
                success: false,
                message: "Not authorized",
            });
        }

        if (request.status !== "pending") {
            return res.status(400).json({
                success: false,
                message: "Request is not pending",
            });
        }

        const alreadyFriends = await checkFriendship(
            request.senderId,
            request.receiverId
        );

        if (alreadyFriends) {
            return res.status(400).json({
                success: false,
                message: "Already friends",
            });
        }

        const [acceptor, originalSender] = await Promise.all([
            db.query.users.findFirst({
                where: eq(users.id, currentUserId),
                columns: { name: true },
            }),
            db.query.users.findFirst({
                where: eq(users.id, request.senderId),
                columns: { pushToken: true },
            }),
        ]);

        await db.transaction(async (tx) => {
            await tx.insert(friends).values([
                {
                    userId: request.senderId,
                    friendId: request.receiverId,
                    friendRequestId: request.id,
                },
                {
                    userId: request.receiverId,
                    friendId: request.senderId,
                    friendRequestId: request.id,
                },
            ]);

            await tx
                .delete(friendRequests)
                .where(eq(friendRequests.id, requestId));
        });

        sendPushNotification(originalSender?.pushToken, {
            title: "Friend Request Accepted",
            body: `${acceptor?.name ?? "Someone"} accepted your friend request`,
            sound: "default",
            data: {
                type: "FRIEND_REQUEST_ACCEPTED",
                acceptorId: currentUserId,
                acceptorName: acceptor?.name ?? "",
            },
        });

        return res.status(200).json({ success: true });
    } catch (error) {
        console.error("acceptFriendRequest error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};