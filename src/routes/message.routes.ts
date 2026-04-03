import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { getMessages, sendMessage } from "../controllers/messageController";
import { uploadMessageMedia } from "../config/cloudinary";

const router = Router({ mergeParams: true });

router.get("/", authMiddleware, getMessages);
router.post("/:conversationId/messages", authMiddleware, uploadMessageMedia.single("media"), sendMessage);

export default router;