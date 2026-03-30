import { db } from "./index";
import { eq, or, and, ilike, ne } from "drizzle-orm";
import {
    users,
    conversations,
    conversationMembers,
    messages,
    messageReadReceipts,
    friendRequests,
    friends,
    notes,
    type NewNote,
    type NewUser,
    type NewConversation,
    type NewConversationMember,
    type NewMessage,
    type NewMessageReadReceipt,
    type NewFriendRequest,
    type NewFriend,
} from "./schema";

export const createUser = async (data: NewUser) => {
    const [user] = await db.insert(users).values(data).returning();
    return user;
};

export const getUserById = async (id: string) => {
    return db.query.users.findFirst({ where: eq(users.id, id) });
};

export const getUserByEmail = async (email: string) => {
    return db.query.users.findFirst({ where: eq(users.email, email) });
};

export const updateUser = async (id: string, data: Partial<NewUser>) => {
    const existing = await getUserById(id);
    if (!existing) throw new Error(`User with id ${id} not found`);
    const [user] = await db.update(users).set(data).where(eq(users.id, id)).returning();
    return user;
};

export const setUserOnlineStatus = async (id: string, isOnline: boolean) => {
    const [user] = await db
        .update(users)
        .set({ isOnline, lastSeenAt: isOnline ? undefined : new Date() })
        .where(eq(users.id, id))
        .returning();
    return user;
};

export const updateRefreshToken = async (id: string, refreshToken: string | null) => {
    const [user] = await db
        .update(users)
        .set({ refreshToken })
        .where(eq(users.id, id))
        .returning();
    return user;
};

export const searchUsers = async (query: string, currentUserId: string) => {
    return db.query.users.findMany({
        where: (users, { and, or, ilike, ne }) =>
            and(
                ne(users.id, currentUserId),
                or(
                    ilike(users.name, `%${query}%`)
                )
            ),
    });
};

export const sendFriendRequest = async (senderId: string, receiverId: string) => {
    const existing = await db.query.friendRequests.findFirst({
        where: (fr, { or, and, eq }) =>
            or(
                and(eq(fr.senderId, senderId), eq(fr.receiverId, receiverId)),
                and(eq(fr.senderId, receiverId), eq(fr.receiverId, senderId))
            ),
    });
    if (existing) throw new Error("Friend request already exists between these users");

    const [request] = await db
        .insert(friendRequests)
        .values({ senderId, receiverId, status: "pending" })
        .returning();
    return request;
};

export const getFriendRequestById = async (id: string) => {
    return db.query.friendRequests.findFirst({
        where: eq(friendRequests.id, id),
        with: { sender: true, receiver: true },
    });
};

export const getPendingRequestsForUser = async (userId: string) => {
    return db.query.friendRequests.findMany({
        where: (fr, { and, eq }) =>
            and(eq(fr.receiverId, userId), eq(fr.status, "pending")),
        with: { sender: true },
    });
};

export const getSentRequestsForUser = async (userId: string) => {
    return db.query.friendRequests.findMany({
        where: (fr, { and, eq }) =>
            and(eq(fr.senderId, userId), eq(fr.status, "pending")),
        with: { receiver: true },
    });
};

export const updateFriendRequestStatus = async (
    id: string,
    status: "accepted" | "rejected" | "cancelled"
) => {
    const existing = await getFriendRequestById(id);
    if (!existing) throw new Error(`Friend request with id ${id} not found`);

    const [request] = await db
        .update(friendRequests)
        .set({ status })
        .where(eq(friendRequests.id, id))
        .returning();
    return request;
};

export const createFriend = async (data: NewFriend) => {
    const [friend] = await db.insert(friends).values(data).returning();
    return friend;
};

export const acceptFriendRequest = async (requestId: string) => {
    const request = await getFriendRequestById(requestId);
    if (!request) throw new Error(`Friend request with id ${requestId} not found`);
    if (request.status !== "pending") throw new Error("Friend request is no longer pending");

    const [updatedRequest] = await db
        .update(friendRequests)
        .set({ status: "accepted" })
        .where(eq(friendRequests.id, requestId))
        .returning();

    const [friendship] = await db
        .insert(friends)
        .values({
            userId: request.senderId,
            friendId: request.receiverId,
            friendRequestId: requestId,
        })
        .returning();

    const conversation = await createConversation(
        { isGroup: false, createdBy: request.senderId },
        [request.senderId, request.receiverId]
    );

    return { friendship, conversation, request: updatedRequest };
};

export const getFriendsForUser = async (userId: string) => {
    return db.query.friends.findMany({
        where: (f, { or, eq }) =>
            or(eq(f.userId, userId), eq(f.friendId, userId)),
        with: { user: true, friend: true },
    });
};

export const checkFriendship = async (userAId: string, userBId: string) => {
    return db.query.friends.findFirst({
        where: (f, { or, and, eq }) =>
            or(
                and(eq(f.userId, userAId), eq(f.friendId, userBId)),
                and(eq(f.userId, userBId), eq(f.friendId, userAId))
            ),
    });
};

export const removeFriend = async (userAId: string, userBId: string) => {
    const existing = await checkFriendship(userAId, userBId);
    if (!existing) throw new Error("Friendship does not exist");

    const [removed] = await db
        .delete(friends)
        .where(
            or(
                and(eq(friends.userId, userAId), eq(friends.friendId, userBId)),
                and(eq(friends.userId, userBId), eq(friends.friendId, userAId))
            )
        )
        .returning();
    return removed;
};

export const createNote = async (data: NewNote) => {
    const [note] = await db.insert(notes).values(data).returning();
    return note;
};

export const getNoteById = async (id: string) => {
    return db.query.notes.findFirst({
        where: eq(notes.id, id),
        with: { user: true },
    });
};

export const getNoteByUserId = async (userId: string) => {
    return db.query.notes.findFirst({
        where: eq(notes.userId, userId),
        with: { user: true },
        orderBy: (notes, { desc }) => [desc(notes.createdAt)],
    });
};

export const updateNote = async (id: string, data: Partial<NewNote>) => {
    const existing = await getNoteById(id);
    if (!existing) throw new Error(`Note with id ${id} not found`);
    const [note] = await db.update(notes).set(data).where(eq(notes.id, id)).returning();
    return note;
};

export const deleteNote = async (id: string, userId: string) => {
    const existing = await getNoteById(id);
    if (!existing) throw new Error(`Note with id ${id} not found`);
    if (existing.userId !== userId) throw new Error("You can only delete your own notes");
    const [note] = await db.delete(notes).where(eq(notes.id, id)).returning();
    return note;
};

export const createConversation = async (
    data: Partial<NewConversation> & { createdBy: string },
    memberIds: string[]
) => {
    const [conversation] = await db
        .insert(conversations)
        .values({
            name: data.name ?? null,
            imageUrl: data.imageUrl ?? null,
            isGroup: data.isGroup ?? false,
            createdBy: data.createdBy,
        })
        .returning();

    await db.insert(conversationMembers).values(
        memberIds.map((userId) => ({
            conversationId: conversation.id,
            userId,
            role: userId === data.createdBy ? "admin" : "member",
        }))
    );

    return conversation;
};

export const getConversationById = async (id: string) => {
    return db.query.conversations.findFirst({
        where: eq(conversations.id, id),
        with: {
            members: { with: { user: true } },
            lastMessage: { with: { sender: true } },
        },
    });
};

export const getConversationsForUser = async (userId: string) => {
    const memberships = await db.query.conversationMembers.findMany({
        where: eq(conversationMembers.userId, userId),
        with: {
            conversation: {
                with: {
                    members: { with: { user: true } },
                    lastMessage: { with: { sender: true } },
                },
            },
        },
    });
    return memberships.map((m) => m.conversation);
};

export const updateConversation = async (id: string, data: Partial<NewConversation>) => {
    const existing = await getConversationById(id);
    if (!existing) throw new Error(`Conversation with id ${id} not found`);
    const [conversation] = await db
        .update(conversations)
        .set(data)
        .where(eq(conversations.id, id))
        .returning();
    return conversation;
};

export const addMemberToConversation = async (conversationId: string, userId: string) => {
    const [member] = await db
        .insert(conversationMembers)
        .values({ conversationId, userId, role: "member" })
        .returning();
    return member;
};

export const removeMemberFromConversation = async (conversationId: string, userId: string) => {
    const [member] = await db
        .delete(conversationMembers)
        .where(
            and(
                eq(conversationMembers.conversationId, conversationId),
                eq(conversationMembers.userId, userId)
            )
        )
        .returning();
    return member;
};

export const createMessage = async (data: NewMessage) => {
    const areFriends = await checkFriendship(data.senderId, data.senderId);

    const [message] = await db.insert(messages).values(data).returning();

    await db
        .update(conversations)
        .set({ lastMessageId: message.id })
        .where(eq(conversations.id, data.conversationId));

    return message;
};

export const getMessageById = async (id: string) => {
    return db.query.messages.findFirst({
        where: eq(messages.id, id),
        with: { sender: true, replyTo: true, readReceipts: true },
    });
};

export const getMessagesForConversation = async (
    conversationId: string,
    limit = 50,
    offset = 0
) => {
    return db.query.messages.findMany({
        where: (messages, { eq }) => eq(messages.conversationId, conversationId),
        with: {
            sender: true,
            replyTo: { with: { sender: true } },
            readReceipts: { with: { user: true } },
        },
        orderBy: (messages, { desc }) => [desc(messages.createdAt)],
        limit,
        offset,
    });
};

export const softDeleteMessage = async (id: string, userId: string) => {
    const existing = await getMessageById(id);
    if (!existing) throw new Error(`Message with id ${id} not found`);
    if (existing.senderId !== userId) throw new Error("You can only delete your own messages");

    const [message] = await db
        .update(messages)
        .set({ isDeleted: true, content: null, imageUrl: null })
        .where(eq(messages.id, id))
        .returning();
    return message;
};

export const updatePushToken = async (id: string, pushToken: string | null) => {
    const [user] = await db
        .update(users)
        .set({ pushToken })
        .where(eq(users.id, id))
        .returning();
    return user;
};

export const markMessageAsRead = async (messageId: string, userId: string) => {
    const existing = await db.query.messageReadReceipts.findFirst({
        where: (r, { and, eq }) =>
            and(eq(r.messageId, messageId), eq(r.userId, userId)),
    });
    if (existing) return existing;

    const [receipt] = await db
        .insert(messageReadReceipts)
        .values({ messageId, userId })
        .returning();
    return receipt;
};

export const markConversationAsRead = async (conversationId: string, userId: string) => {
    const unread = await db.query.messages.findMany({
        where: (m, { eq }) => eq(m.conversationId, conversationId),
    });

    for (const message of unread) {
        await markMessageAsRead(message.id, userId);
    }

    const lastMessage = unread[unread.length - 1];
    if (lastMessage) {
        await db
            .update(conversationMembers)
            .set({ lastReadMessageId: lastMessage.id })
            .where(
                and(
                    eq(conversationMembers.conversationId, conversationId),
                    eq(conversationMembers.userId, userId)
                )
            );
    }
};

export const getUnreadCountForConversation = async (
    conversationId: string,
    userId: string
) => {
    const membership = await db.query.conversationMembers.findFirst({
        where: (cm, { and, eq }) =>
            and(
                eq(cm.conversationId, conversationId),
                eq(cm.userId, userId)
            ),
    });

    if (!membership?.lastReadMessageId) {
        const allMessages = await db.query.messages.findMany({
            where: (m, { eq }) => eq(m.conversationId, conversationId),
        });
        return allMessages.length;
    }

    const lastRead = await getMessageById(membership.lastReadMessageId);
    if (!lastRead) return 0;

    const unread = await db.query.messages.findMany({
        where: (m, { eq, and, gt }) =>
            and(
                eq(m.conversationId, conversationId),
                gt(m.createdAt, lastRead.createdAt)
            ),
    });
    return unread.length;
};