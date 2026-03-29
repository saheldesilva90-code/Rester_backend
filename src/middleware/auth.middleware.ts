import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { ENV } from "../config/env";
import { getUserById } from "../db/queries";

declare global {
    namespace Express {
        interface Request {
            user: {
                id: string;
                email: string;
                name: string;
            };
        }
    }
}

export const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith("Bearer ")) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        const token = authHeader.split(" ")[1];

        if (!token || token.split(".").length !== 3) {
            res.status(401).json({ success: false, message: "Invalid token format" });
            return;
        }

        const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: string };

        if (!decoded.userId || typeof decoded.userId !== "string") {
            res.status(401).json({ success: false, message: "Invalid token payload" });
            return;
        }

        const user = await getUserById(decoded.userId);
        if (!user) {
            res.status(401).json({ success: false, message: "Unauthorized" });
            return;
        }

        if (!user.isVerified) {
            res.status(401).json({ success: false, message: "Email not verified" });
            return;
        }

        req.user = { id: user.id, email: user.email, name: user.name };
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: "Unauthorized" });
    }
};