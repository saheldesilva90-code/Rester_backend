import { Request, Response } from "express";
import { db } from "../db";
import { messages, conversations, conversationMembers } from "../db/schema";
import { eq, and } from "drizzle-orm";

export const sendMessage = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const conversationId = String(req.params.conversationId);
        const { content, replyToId } = req.body;

        if (!content?.trim()) {
            return res.status(400).json({ success: false, message: "Content is required" });
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
                content: content.trim(),
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