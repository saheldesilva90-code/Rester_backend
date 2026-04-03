import express from "express";
import cors from "cors";
import helmet from "helmet";
import { ENV } from "./config/env";
import { Server } from "socket.io";
import { initSocket } from "./socket";
import { createServer } from "http";
import authRoutes from "./routes/auth.routes";
import userRoutes from "./routes/user.routes";
import friendRequestRoutes from "./routes/friend-request.routes";
import friendRoutes from "./routes/friend.routes";
import noteRoutes from "./routes/note.routes";
import audioRouter from "./routes/audio.routes";
import messageRouter from "./routes/message.routes";
import conversationRoutes from "./routes/conversation.routes";
import { globalRateLimit } from "./middleware/rate-limit.middleware";
import { sanitizeMiddleware } from "./middleware/sanitize.middleware";

const app = express();
const httpServer = createServer(app);

const io = new Server(httpServer, {
    cors: { origin: "*" },
});

app.set("trust proxy", 1);
app.use(helmet());
app.use(cors({ origin: ENV.APP_URL }));
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true, limit: "10kb" }));
app.use(globalRateLimit);
app.use(sanitizeMiddleware);
app.disable("x-powered-by");

app.set("io", io);

app.get("/", (req, res) => {
    res.json({ success: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/users", userRoutes);
app.use("/api/friend-requests", friendRequestRoutes);
app.use("/api/friends", friendRoutes);
app.use("/api/conversations", conversationRoutes);
app.use("/api/notes", noteRoutes);
app.use("/api/audio", audioRouter);
app.use("/api/conversations/:conversationId/messages", messageRouter);

initSocket(io);

httpServer.listen(ENV.PORT || 3000, () => {
    console.log(`Server is running on PORT ${ENV.PORT || 3000}`);
});