import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
    getOrCreateConversation,
    getConversations,
    getConversation,
} from "../controllers/conversationController";
 
const router = Router();
 
router.post("/", authMiddleware, getOrCreateConversation);
router.get("/", authMiddleware, getConversations);
router.get("/:conversationId", authMiddleware, getConversation);
 
export default router;