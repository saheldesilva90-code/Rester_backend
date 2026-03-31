import { Router } from "express";
import { authMiddleware } from "../middleware/auth.middleware";
import { getAudioUrl } from "../controllers/audioController";

const router = Router();

router.get("/url/:trackId", authMiddleware, getAudioUrl);

export default router;