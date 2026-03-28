import { pgTable, text, timestamp, uuid, boolean, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const users = pgTable("users", {
    id: uuid("id").defaultRandom().primaryKey(),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    imageUrl: text("image_url"),
    passwordHash: text("password_hash").notNull(),
    refreshToken: text("refresh_token"),
    pushToken: text("push_token"),
    verificationCode: text("verification_code"),
    verificationCodeExpiry: timestamp("verification_code_expiry", { mode: "date" }),
    isVerified: boolean("is_verified").notNull().default(false),
    isOnline: boolean("is_online").notNull().default(false),
    lastSeenAt: timestamp("last_seen_at", { mode: "date" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
});

export const conversations = pgTable("conversations", {
    id: uuid("id").defaultRandom().primaryKey(),
    name: text("name"),
    imageUrl: text("image_url"),
    isGroup: boolean("is_group").notNull().default(false),
    lastMessageId: uuid("last_message_id"),
    createdBy: uuid("created_by")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
});

export const conversationMembers = pgTable("conversation_members", {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
        .notNull()
        .references(() => conversations.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    joinedAt: timestamp("joined_at", { mode: "date" }).notNull().defaultNow(),
    lastReadMessageId: uuid("last_read_message_id"),
});

export const messages = pgTable("messages", {
    id: uuid("id").defaultRandom().primaryKey(),
    conversationId: uuid("conversation_id")
        .notNull()
        .references(() => conversations.id, { onDelete: "cascade" }),
    senderId: uuid("sender_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    content: text("content"),
    imageUrl: text("image_url"),
    replyToId: uuid("reply_to_id"),
    isDeleted: boolean("is_deleted").notNull().default(false),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
});

export const messageReadReceipts = pgTable("message_read_receipts", {
    id: uuid("id").defaultRandom().primaryKey(),
    messageId: uuid("message_id")
        .notNull()
        .references(() => messages.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    readAt: timestamp("read_at", { mode: "date" }).notNull().defaultNow(),
});

export const friendRequests = pgTable("friend_requests", {
    id: uuid("id").defaultRandom().primaryKey(),
    senderId: uuid("sender_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    receiverId: uuid("receiver_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { mode: "date" })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
});

export const friends = pgTable("friends", {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    friendId: uuid("friend_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    friendRequestId: uuid("friend_request_id")
        .notNull()
        .references(() => friendRequests.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { mode: "date" }).notNull().defaultNow(),
}, (table) => ({
    uniqueFriendship: uniqueIndex("unique_friendship").on(table.userId, table.friendId),
}));

export const usersRelations = relations(users, ({ many }) => ({
    conversationMembers: many(conversationMembers),
    sentMessages: many(messages),
    readReceipts: many(messageReadReceipts),
    createdConversations: many(conversations),
    sentFriendRequests: many(friendRequests, { relationName: "sentFriendRequests" }),
    receivedFriendRequests: many(friendRequests, { relationName: "receivedFriendRequests" }),
    friends: many(friends),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
    members: many(conversationMembers),
    messages: many(messages),
    createdBy: one(users, { fields: [conversations.createdBy], references: [users.id] }),
    lastMessage: one(messages, { fields: [conversations.lastMessageId], references: [messages.id] }),
}));

export const conversationMembersRelations = relations(conversationMembers, ({ one }) => ({
    conversation: one(conversations, { fields: [conversationMembers.conversationId], references: [conversations.id] }),
    user: one(users, { fields: [conversationMembers.userId], references: [users.id] }),
    lastReadMessage: one(messages, { fields: [conversationMembers.lastReadMessageId], references: [messages.id] }),
}));

export const messagesRelations = relations(messages, ({ one, many }) => ({
    conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
    sender: one(users, { fields: [messages.senderId], references: [users.id] }),
    replyTo: one(messages, { fields: [messages.replyToId], references: [messages.id] }),
    readReceipts: many(messageReadReceipts),
}));

export const messageReadReceiptsRelations = relations(messageReadReceipts, ({ one }) => ({
    message: one(messages, { fields: [messageReadReceipts.messageId], references: [messages.id] }),
    user: one(users, { fields: [messageReadReceipts.userId], references: [users.id] }),
}));

export const friendRequestsRelations = relations(friendRequests, ({ one }) => ({
    sender: one(users, {
        fields: [friendRequests.senderId],
        references: [users.id],
        relationName: "sentFriendRequests",
    }),
    receiver: one(users, {
        fields: [friendRequests.receiverId],
        references: [users.id],
        relationName: "receivedFriendRequests",
    }),
}));

export const friendsRelations = relations(friends, ({ one }) => ({
    user: one(users, { fields: [friends.userId], references: [users.id] }),
    friend: one(users, { fields: [friends.friendId], references: [users.id] }),
    friendRequest: one(friendRequests, { fields: [friends.friendRequestId], references: [friendRequests.id] }),
}));

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type NewConversation = typeof conversations.$inferInsert;
export type ConversationMember = typeof conversationMembers.$inferSelect;
export type NewConversationMember = typeof conversationMembers.$inferInsert;
export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;
export type MessageReadReceipt = typeof messageReadReceipts.$inferSelect;
export type NewMessageReadReceipt = typeof messageReadReceipts.$inferInsert;
export type FriendRequest = typeof friendRequests.$inferSelect;
export type NewFriendRequest = typeof friendRequests.$inferInsert;
export type Friend = typeof friends.$inferSelect;
export type NewFriend = typeof friends.$inferInsert;