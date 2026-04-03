import { eq, and } from "drizzle-orm";
import { db } from "../db";
import { conversations, conversationMembers, messages } from "../db/schema";
import { Request, Response } from "express";

export const getOrCreateConversation = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const { memberIds, isGroup, name } = req.body;

        if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
            return res.status(400).json({ success: false, message: "memberIds is required" });
        }

        const allMemberIds: string[] = [...new Set([currentUserId, ...memberIds])];

        if (!isGroup && allMemberIds.length === 2) {
            const otherId = memberIds[0] as string;

            const existingConversations = await db.query.conversationMembers.findMany({
                where: eq(conversationMembers.userId, currentUserId),
                with: { conversation: { with: { members: true } } },
            });

            for (const cm of existingConversations) {
                const conv = cm.conversation;
                if (conv.isGroup) continue;
                const memberUserIds = conv.members.map((m: any) => m.userId);
                if (
                    memberUserIds.length === 2 &&
                    memberUserIds.includes(currentUserId) &&
                    memberUserIds.includes(otherId)
                ) {
                    return res.status(200).json({
                        success: true,
                        data: { conversation: conv },
                    });
                }
            }
        }

        const [newConversation] = await db
            .insert(conversations)
            .values({
                isGroup: isGroup ?? false,
                name: isGroup ? name : null,
                createdBy: currentUserId,
            })
            .returning();

        await db.insert(conversationMembers).values(
            allMemberIds.map((uid) => ({
                conversationId: newConversation.id,
                userId: uid,
                role: uid === currentUserId ? "admin" : "member",
            }))
        );

        const fullConversation = await db.query.conversations.findFirst({
            where: eq(conversations.id, newConversation.id),
            with: { members: true },
        });

        return res.status(201).json({
            success: true,
            data: { conversation: fullConversation },
        });
    } catch (error) {
        console.error("getOrCreateConversation error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getConversations = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;

        const memberRows = await db.query.conversationMembers.findMany({
            where: eq(conversationMembers.userId, currentUserId),
            with: {
                conversation: {
                    with: {
                        members: {
                            with: {
                                user: {
                                    columns: { id: true, name: true, imageUrl: true, isOnline: true },
                                },
                            },
                        },
                    },
                },
            },
        });

        const convs = memberRows.map((row) => row.conversation);

        return res.status(200).json({ success: true, data: { conversations: convs } });
    } catch (error) {
        console.error("getConversations error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMessages = async (req: Request, res: Response) => {
    try {
        const currentUserId = req.user.id;
        const conversationId = String(req.params.conversationId); // ✅ fix the type error

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
            },
            orderBy: (messages, { asc }) => [asc(messages.createdAt)],
        });

        return res.status(200).json({ success: true, data: { messages: msgs } });
    } catch (error) {
        console.error("getMessages error:", error);
        return res.status(500).json({ success: false, message: "Internal server error" });
    }
};