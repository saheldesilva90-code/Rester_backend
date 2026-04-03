import { Request, Response } from "express";
import { db } from "../db";
import { messages, conversations, conversationMembers } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const sendMessage = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const conversationId = String(req.params.conversationId);
        const { content, replyToId } = req.body;

        const mediaUrl: string | null = (req.file as any)?.path ?? null;
        const mediaType: "image" | "video" | null = req.file
            ? req.file.mimetype.startsWith("video/") ? "video" : "image"
            : null;

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

        const [newMessage] = await db
            .insert(messages)
            .values({
                conversationId,
                senderId: currentUserId,
                content: content?.trim() ?? null,
                imageUrl: mediaUrl,
                mediaType,
                replyToId: replyToId ?? null,
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

        const [updated] = await db
            .update(messages)
            .set({
                content: content.trim(),
                updatedAt: new Date(),
            })
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

        await db
            .delete(messages)
            .where(eq(messages.id, messageId));

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
            },
            orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        });

        return res.status(200).json({ success: true, data: { messages: msgs } });
    } catch (error) {
        console.error("getMessages error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};