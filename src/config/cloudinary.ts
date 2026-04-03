import { v2 as cloudinary } from "cloudinary";
import { CloudinaryStorage } from "multer-storage-cloudinary";
import multer from "multer";
import { ENV } from "./env";

cloudinary.config({
    cloud_name: ENV.CLOUDINARY_CLOUD_NAME!,
    api_key: ENV.CLOUDINARY_API_KEY!,
    api_secret: ENV.CLOUDINARY_API_SECRET!,
});

const storage = new CloudinaryStorage({
    cloudinary,
    params: {
        folder: "profile_pictures",
        allowed_formats: ["jpg", "jpeg", "png", "webp"],
        transformation: [{ width: 400, height: 400, crop: "fill", gravity: "face" }],
    } as any,
});

export const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
});

export { cloudinary };