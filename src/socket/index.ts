import { Server, Socket } from "socket.io";
import { db } from "../db";
import { messages, conversationMembers, conversations } from "../db/schema";
import { eq, and } from "drizzle-orm";

interface AuthSocket extends Socket {
    userId?: string;
}

export function initSocket(io: Server) {
    io.use((socket: AuthSocket, next) => {
        const userId = socket.handshake.auth?.userId;
        if (!userId) return next(new Error("Unauthorized"));
        socket.userId = userId;
        next();
    });

    io.on("connection", (socket: AuthSocket) => {
        const userId = socket.userId!;
        console.log(`Socket connected: ${userId}`);

        socket.on("join_conversations", async () => {
            const memberships = await db.query.conversationMembers.findMany({
                where: eq(conversationMembers.userId, userId),
            });
            memberships.forEach((m) => socket.join(m.conversationId));
        });

        socket.on("join_conversation", (conversationId: string) => {
            socket.join(conversationId);
        });

        socket.on("send_message", async ({ conversationId, content, replyToId }) => {
            try {
                const membership = await db.query.conversationMembers.findFirst({
                    where: and(
                        eq(conversationMembers.conversationId, conversationId),
                        eq(conversationMembers.userId, userId)
                    ),
                });

                if (!membership) {
                    socket.emit("error", { message: "Not a member of this conversation" });
                    return;
                }

                const [newMessage] = await db
                    .insert(messages)
                    .values({
                        conversationId,
                        senderId: userId,
                        content,
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
                    },
                });

                io.to(conversationId).emit("new_message", fullMessage);
            } catch (err) {
                console.error("send_message error:", err);
                socket.emit("error", { message: "Failed to send message" });
            }
        });

        socket.on("typing_start", ({ conversationId }) => {
            socket.to(conversationId).emit("user_typing", { userId, conversationId });
        });

        socket.on("typing_stop", ({ conversationId }) => {
            socket.to(conversationId).emit("user_stopped_typing", { userId, conversationId });
        });

        socket.on("disconnect", () => {
            console.log(`Socket disconnected: ${userId}`);
        });
    });
}