import { Request, Response } from "express";
import { db } from "../db";
import { messages, conversations, conversationMembers, messageReactions } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const sendMessage = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const conversationId = String(req.params.conversationId);
        const { content, replyToId } = req.body;

        console.log("sendMessage hit");
        console.log("body:", req.body);
        console.log("file:", req.file
            ? { fieldname: req.file.fieldname, mimetype: req.file.mimetype, size: req.file.size, path: (req.file as any).path }
            : "NO FILE"
        );

        const mediaUrl: string | null = (req.file as any)?.path ?? null;

        let mediaType: "image" | "video" | "audio" | null = null;
        if (req.file) {
            const mime = req.file.mimetype;
            if (mime.startsWith("video/")) {
                mediaType = "video";
            } else if (
                mime.startsWith("audio/") ||
                (mime === "application/octet-stream" && req.file.originalname?.match(/\.(m4a|mp3|aac|wav|ogg)$/i))
            ) {
                mediaType = "audio";
            } else {
                mediaType = "image";
            }
        }

        if (!content?.trim() && !mediaUrl) {
            return res.status(400).json({ success: false, message: "Content or media is required" });
        }

        const membership = await db.query.conversationMembers.findFirst({
            where: and(
                eq(conversationMembers.conversationId, conversationId),
                eq(conversationMembers.userId, currentUserId)
            ),
        });

        if (!membership) {
            return res.status(403).json({ success: false, message: "Not a member" });
        }

        const durationMs = req.body.durationMs ? Number(req.body.durationMs) : null;

        const [newMessage] = await db
            .insert(messages)
            .values({
                conversationId,
                senderId: currentUserId,
                content: content?.trim() ?? null,
                imageUrl: mediaUrl,
                mediaType,
                replyToId: replyToId ?? null,
                durationMs,
            })
            .returning();

        await db
            .update(conversations)
            .set({ lastMessageId: newMessage.id, updatedAt: new Date() })
            .where(eq(conversations.id, conversationId));

        const fullMessage = await db.query.messages.findFirst({
            where: eq(messages.id, newMessage.id),
            with: {
                sender: { columns: { id: true, name: true, imageUrl: true } },
                replyTo: {
                    with: {
                        sender: { columns: { id: true, name: true } },
                    },
                },
            },
        });

        req.app.get("io")?.to(conversationId).emit("new_message", fullMessage);

        console.log("Message saved:", newMessage.id, "| mediaType:", mediaType, "| mediaUrl:", mediaUrl);

        return res.status(201).json({ success: true, data: { message: fullMessage } });
    } catch (error) {
        console.error("sendMessage error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateMessage = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const messageId = String(req.params.messageId);
        const { content } = req.body;

        if (!content?.trim()) {
            return res.status(400).json({ success: false, message: "Content is required" });
        }

        const message = await db.query.messages.findFirst({
            where: eq(messages.id, messageId),
        });

        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        if (message.senderId !== currentUserId) {
            return res.status(403).json({ success: false, message: "Not allowed" });
        }

        await db
            .update(messages)
            .set({ content: content.trim(), updatedAt: new Date() })
            .where(eq(messages.id, messageId))
            .returning();

        const fullMessage = await db.query.messages.findFirst({
            where: eq(messages.id, messageId),
            with: {
                sender: { columns: { id: true, name: true, imageUrl: true } },
            },
        });

        req.app.get("io")?.to(message.conversationId).emit("message_updated", fullMessage);

        return res.status(200).json({ success: true, data: { message: fullMessage } });
    } catch (err) {
        console.error("updateMessage error:", err);
        return res.status(500).json({ success: false });
    }
};

export const deleteMessage = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const messageId = String(req.params.messageId);

        const message = await db.query.messages.findFirst({
            where: eq(messages.id, messageId),
        });

        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        if (message.senderId !== currentUserId) {
            return res.status(403).json({ success: false, message: "Not allowed" });
        }

        await db.delete(messages).where(eq(messages.id, messageId));

        req.app.get("io")?.to(message.conversationId).emit("message_deleted", {
            id: messageId,
            conversationId: message.conversationId,
        });

        return res.status(200).json({ success: true });
    } catch (err) {
        console.error("deleteMessage error:", err);
        return res.status(500).json({ success: false });
    }
};

export const getMessages = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const conversationId = String(req.params.conversationId);

        const membership = await db.query.conversationMembers.findFirst({
            where: and(
                eq(conversationMembers.conversationId, conversationId),
                eq(conversationMembers.userId, currentUserId)
            ),
        });

        if (!membership) {
            return res.status(403).json({ success: false, message: "Not a member of this conversation" });
        }

        const msgs = await db.query.messages.findMany({
            where: eq(messages.conversationId, conversationId),
            with: {
                sender: { columns: { id: true, name: true, imageUrl: true } },
                replyTo: {
                    with: {
                        sender: { columns: { id: true, name: true } },
                    },
                },
                reactions: {
                    columns: { emoji: true, userId: true },
                },
            },
            orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        });

        return res.status(200).json({ success: true, data: { messages: msgs } });
    } catch (error) {
        console.error("getMessages error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const reactToMessage = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const messageId = String(req.params.messageId);
        const { emoji } = req.body;

        if (!emoji) {
            return res.status(400).json({ success: false, message: "Emoji is required" });
        }

        const message = await db.query.messages.findFirst({
            where: eq(messages.id, messageId),
        });

        if (!message) {
            return res.status(404).json({ success: false, message: "Message not found" });
        }

        const existing = await db.query.messageReactions.findFirst({
            where: and(
                eq(messageReactions.messageId, messageId),
                eq(messageReactions.userId, currentUserId),
                eq(messageReactions.emoji, emoji)
            ),
        });

        if (existing) {
            await db.delete(messageReactions).where(
                and(
                    eq(messageReactions.messageId, messageId),
                    eq(messageReactions.userId, currentUserId),
                    eq(messageReactions.emoji, emoji)
                )
            );
        } else {
            await db.insert(messageReactions).values({
                messageId,
                userId: currentUserId,
                emoji,
            });
        }

        const updatedReactions = await db.query.messageReactions.findMany({
            where: eq(messageReactions.messageId, messageId),
            columns: { emoji: true, userId: true },
        });

        req.app.get("io")?.to(message.conversationId).emit("message_reaction", {
            messageId,
            reactions: updatedReactions,
        });

        return res.status(200).json({ success: true, data: { reactions: updatedReactions } });
    } catch (err) {
        console.error("reactToMessage error:", err);
        return res.status(500).json({ success: false });
    }
};