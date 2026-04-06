import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import { ENV } from "./env";

cloudinary.config({
    cloud_name: ENV.CLOUDINARY_CLOUD_NAME!,
    api_key: ENV.CLOUDINARY_API_KEY!,
    api_secret: ENV.CLOUDINARY_API_SECRET!,
});

const profileStorage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "profile_pictures",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
    } as any,
});

export const upload = multer({
    storage: profileStorage,
    limits: { fileSize: 5 * 1024 * 1024 },
});

const messageMediaStorage = new CloudinaryStorage({
    cloudinary,
    params: (req: any, file: Express.Multer.File) => {
        const isVideo = file.mimetype.startsWith("video/");
        const isAudio = file.mimetype.startsWith("audio/") ||
            file.mimetype === "application/octet-stream";

        return {
            folder: "message_media",
            resource_type: "auto",
            ...(!isVideo && !isAudio
                ? { transformation: [{ width: 1200, crop: "limit" }] }
                : {}),
        };
    },
});

export const uploadMessageMedia = multer({
    storage: messageMediaStorage,
    limits: { fileSize: 50 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        const allowed = [
            "image/jpeg", "image/png", "image/webp", "image/gif",
            "video/mp4", "video/quicktime", "video/avi", "video/webm",
            "audio/mp4",
            "audio/m4a",
            "audio/x-m4a",
            "audio/mpeg",
            "audio/aac",
            "audio/wav",
            "audio/x-wav",
            "audio/webm",
            "audio/ogg",
            "application/octet-stream",
        ];

        if (allowed.includes(file.mimetype)) {
            cb(null, true);
        } else {
            console.error("Rejected file mimetype:", file.mimetype);
            cb(new Error(`Unsupported file type: ${file.mimetype}`));
        }
    },
});

export { cloudinary };