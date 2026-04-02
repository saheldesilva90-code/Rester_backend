import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { getFriendStatus } from "../controllers/friend-requestController";

const router = Router();

router.get("/status/:userId", authMiddleware, getFriendStatus);

export default router;