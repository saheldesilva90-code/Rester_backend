import { Request, Response, NextFunction } from "express";

const suspiciousPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|TRUNCATE)\b)/gi,
    /(--|;|\/\*|\*\/)/g,
    /(<script|<\/script|javascript:|onerror=|onload=)/gi,
    /(\.\.\/)/,
];

const sanitizeValue = (value: string): boolean => {
    return suspiciousPatterns.some((pattern) => pattern.test(value));
};

const checkObject = (obj: any): boolean => {
    for (const key in obj) {
        const value = obj[key];
        if (typeof value === "string" && sanitizeValue(value)) return true;
        if (typeof value === "object" && value !== null && checkObject(value)) return true;
    }
    return false;
};

export const sanitizeMiddleware = (req: Request, res: Response, next: NextFunction) => {
    if (checkObject(req.body) || checkObject(req.query) || checkObject(req.params)) {
        res.status(400).json({ success: false, message: "Invalid input detected" });
        return;
    }
    next();
};