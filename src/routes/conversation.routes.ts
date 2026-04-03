import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
    getOrCreateConversation,
    getConversations,
    getConversation,
    getMessages,
    sendMessage,
} from "../controllers/conversationController";

const router = Router();

router.post("/", authMiddleware, getOrCreateConversation);
router.get("/", authMiddleware, getConversations);
router.get("/:conversationId", authMiddleware, getConversation);
router.get("/:conversationId/messages", authMiddleware, getMessages);
router.post("/:conversationId/messages", authMiddleware, sendMessage);

export default router;