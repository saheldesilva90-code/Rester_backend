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
            res.status(401).json({ success: false, message: "No token provided" });
            return;
        }

        const token = authHeader.split(" ")[1];
        const decoded = jwt.verify(token, ENV.JWT_SECRET) as { userId: string };

        const user = await getUserById(decoded.userId);
        if (!user) {
            res.status(401).json({ success: false, message: "User not found" });
            return;
        }

        req.user = { id: user.id, email: user.email, name: user.name };
        next();
    } catch (error) {
        res.status(401).json({ success: false, message: "Invalid or expired token" });
    }
};