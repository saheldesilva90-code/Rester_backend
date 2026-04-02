import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
    getFriendStatus,
    sendFriendRequest,
    cancelFriendRequest,
    acceptFriendRequest,
} from "../controllers/friend-requestController";

const router = Router();

router.get("/status/:userId", authMiddleware, getFriendStatus);
router.post("/", authMiddleware, sendFriendRequest);
router.patch("/:requestId/cancel", authMiddleware, cancelFriendRequest);
router.patch("/:requestId/accept", authMiddleware, acceptFriendRequest);

export default router;