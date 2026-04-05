import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { getMessages, sendMessage, updateMessage, deleteMessage, reactToMessage } from "../controllers/messageController";
import { uploadMessageMedia } from "../config/cloudinary";

const router = Router({ mergeParams: true });

router.get("/", authMiddleware, getMessages);
router.post("/", authMiddleware, uploadMessageMedia.single("media"), sendMessage);
router.patch("/:messageId", authMiddleware, updateMessage);
router.delete("/:messageId", authMiddleware, deleteMessage);
router.post("/:messageId/react", authMiddleware, reactToMessage);

export default router;