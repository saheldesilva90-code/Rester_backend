// Your full updated user.route.ts

import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { getMe, updateMe, searchUsers } from "../controllers/userController";

const router = Router();

router.get("/me", authMiddleware, getMe);
router.put("/me", authMiddleware, updateMe);
router.get("/search", authMiddleware, searchUsers);

export default router;