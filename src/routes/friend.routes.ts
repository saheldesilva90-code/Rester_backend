import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { removeFriend } from "../controllers/friendController";

const router = Router();

router.delete("/:friendId", authMiddleware, removeFriend);

export default router;