import { Router } from "express";
import { StreamClient } from "@stream-io/node-sdk";
import { authMiddleware } from "../middleware/auth.middleware"; // your existing JWT middleware

const router = Router();
const streamClient = new StreamClient(
    process.env.STREAM_API_KEY!,
    process.env.STREAM_API_SECRET!
);

router.get("/token", authMiddleware, (req, res) => {
    const userId = req.user.id;
    // Token valid for 1 hour
    const token = streamClient.generateUserToken({
        user_id: userId,
        exp: Math.round(Date.now() / 1000) + 3600,
    });
    res.json({ token });
});

export default router;