import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { getMe, updateMe, searchUsers, getUserProfile, savePushToken } from "../controllers/userController";
import { upload } from "../config/cloudinary";

const router = Router();

router.get("/me", authMiddleware, getMe);
router.patch("/me", authMiddleware, upload.single("image"), updateMe);
router.post("/push-token", authMiddleware, savePushToken);
router.get("/search", authMiddleware, searchUsers);
router.get("/:userId", authMiddleware, getUserProfile);

export default router;