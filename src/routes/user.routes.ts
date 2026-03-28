import { Router } from "express";
import { updateMe } from "../controllers/userController";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

router.put("/me", authMiddleware, updateMe);

export default router;