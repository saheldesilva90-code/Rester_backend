import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
    getOrCreateConversation,
    getConversations,
    getMessages,
} from "../controllers/conversationController";

const router = Router();

router.post("/", authMiddleware, getOrCreateConversation);
router.get("/", authMiddleware, getConversations);
router.get("/:conversationId/messages", authMiddleware, getMessages);

export default router;