import express from "express";
import cors from "cors";
import helmet from "helmet";
import { ENV } from "./config/env";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import friendRequestRoutes from "./routes/friend-request.routes";
import friendRoutes from "./routes/friend.routes";
import noteRoutes from "./routes/note.routes";
import conversationRoutes from "./routes/conversation.routes";
import messageRoutes from "./routes/message.routes";
import { globalRateLimit } from "./middleware/rate-limit.middleware";
import { sanitizeMiddleware } from "./middleware/sanitize.middleware";

const app = express();

app.use(helmet());

app.use(cors({ origin: ENV.APP_URL }));

app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));

app.use(globalRateLimit);

app.use(sanitizeMiddleware);

app.disable("x-powered-by");

const PORT = ENV.PORT || 3000;

app.get("/", (req, res) => {
    res.json({ success: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friend-requests", friendRequestRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/messages", messageRoutes);
app.use("/api/notes", noteRoutes);

app.listen(PORT, () => {
    console.log(`Rester API is up and running PORT ${PORT}`);
});