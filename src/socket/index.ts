import { Server, Socket } from "socket.io";
import { db } from "../db";
import { messages, conversationMembers, conversations, users } from "../db/schema";
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

    io.on("connection", async (socket: AuthSocket) => {
        const userId = socket.userId!;
        console.log(`Socket connected: ${userId}`);

        await db
            .update(users)
            .set({ isOnline: true, lastSeenAt: new Date() })
            .where(eq(users.id, userId));

        socket.broadcast.emit("user_online", { userId });

        const onlineRows = await db
            .select({ id: users.id })
            .from(users)
            .where(eq(users.isOnline, true));
        socket.emit("online_users", { userIds: onlineRows.map((u) => u.id) });

        // ── AUTO-JOIN all conversations on connect (fixes reconnect room loss) ──
        const memberships = await db.query.conversationMembers.findMany({
            where: eq(conversationMembers.userId, userId),
        });
        memberships.forEach((m) => socket.join(m.conversationId));
        console.log(`User ${userId} auto-joined ${memberships.length} conversation rooms`);

        socket.on("get_online_users", async () => {
            const rows = await db
                .select({ id: users.id })
                .from(users)
                .where(eq(users.isOnline, true));
            socket.emit("online_users", { userIds: rows.map((u) => u.id) });
        });

        // Keep these for explicit joins (e.g. entering a new conversation)
        socket.on("join_conversations", async () => {
            const memberships = await db.query.conversationMembers.findMany({
                where: eq(conversationMembers.userId, userId),
            });
            memberships.forEach((m) => socket.join(m.conversationId));
        });

        socket.on("join_conversation", (conversationId: string) => {
            socket.join(conversationId);
        });

        socket.on("send_message", async ({ conversationId, content, replyToId, tempId }) => {
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

                // ── Emit to ALL other sockets in the room (receivers) ──
                socket.to(conversationId).emit("new_message", { ...fullMessage, tempId: null });

                // ── Confirm back to sender with tempId so they can swap the bubble ──
                socket.emit("message_confirmed", { ...fullMessage, tempId });

            } catch (err) {
                console.error("send_message error:", err);
                socket.emit("message_failed", { tempId });
                socket.emit("error", { message: "Failed to send message" });
            }
        });

        socket.on("typing_start", ({ conversationId }) => {
            socket.to(conversationId).emit("user_typing", { userId, conversationId });
        });

        socket.on("typing_stop", ({ conversationId }) => {
            socket.to(conversationId).emit("user_stopped_typing", { userId, conversationId });
        });

        socket.on("disconnect", async () => {
            console.log(`Socket disconnected: ${userId}`);

            const allSockets = await io.fetchSockets();
            const stillConnected = allSockets.some(
                (s) => (s as unknown as AuthSocket).userId === userId && s.id !== socket.id
            );

            if (!stillConnected) {
                await db
                    .update(users)
                    .set({ isOnline: false, lastSeenAt: new Date() })
                    .where(eq(users.id, userId));
                io.emit("user_offline", { userId });
            }
        });
    });
}