import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { getMessages, sendMessage } from "../controllers/messageController";

const router = Router({ mergeParams: true });

router.get("/", authMiddleware, getMessages);
router.post("/", authMiddleware, sendMessage);

export default router;