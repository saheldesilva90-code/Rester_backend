import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import {
    getMyNote,
    getUserNote,
    upsertMyNote,
    deleteMyNote,
} from "../controllers/noteController";

const router = Router();

router.get("/me", authMiddleware, getMyNote);
router.put("/me", authMiddleware, upsertMyNote);
router.delete("/me", authMiddleware, deleteMyNote);
router.get("/user/:userId", authMiddleware, getUserNote);

export default router;