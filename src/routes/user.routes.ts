import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { getMe, updateMe, searchUsers, getUserProfile, savePushToken } from "../controllers/userController";

const router = Router();

router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateMe);
router.post("/push-token", authMiddleware, savePushToken);
router.get("/search", authMiddleware, searchUsers);
router.get("/:userId", authMiddleware, getUserProfile);

export default router;