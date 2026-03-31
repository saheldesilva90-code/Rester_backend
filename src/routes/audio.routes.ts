import { Router, Request, Response } from "express";
import multer from "multer";
import { Readable } from "stream";
import cloudinary from "../config/cloudinary";
import { authMiddleware } from "../middleware/auth.middleware";

const router = Router();

// Use memory storage — we stream the buffer directly to Cloudinary
// so nothing ever touches the server's disk
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB max
    fileFilter: (_req, file, cb) => {
        if (file.mimetype.startsWith("audio/")) {
            cb(null, true);
        } else {
            cb(new Error("Only audio files are allowed"));
        }
    },
});

/**
 * POST /api/audio/upload
 * Receives an audio file, uploads it to Cloudinary, returns the permanent URL.
 * Protected — user must be logged in.
 */
router.post(
    "/upload",
    authMiddleware,
    upload.single("audio"),
    async (req: Request, res: Response) => {
        try {
            if (!req.file) {
                return res.status(400).json({ message: "No audio file provided" });
            }

            // Stream the buffer to Cloudinary instead of saving to disk
            const uploadResult = await new Promise<any>((resolve, reject) => {
                const uploadStream = cloudinary.uploader.upload_stream(
                    {
                        resource_type: "video", // Cloudinary uses "video" for audio files
                        folder: "song_clips",
                        // Use trackId as public_id so re-uploading same track
                        // overwrites instead of creating duplicates
                        public_id: req.body.trackId
                            ? `track_${req.body.trackId}`
                            : undefined,
                        overwrite: true,
                        format: "mp3",
                    },
                    (error, result) => {
                        if (error) reject(error);
                        else resolve(result);
                    }
                );

                // Pipe the file buffer into the upload stream
                const readable = new Readable();
                readable.push(req.file!.buffer);
                readable.push(null);
                readable.pipe(uploadStream);
            });

            return res.status(200).json({
                success: true,
                audioUrl: uploadResult.secure_url,
            });
        } catch (e: any) {
            console.error("Audio upload error:", e);
            return res.status(500).json({ message: e.message || "Upload failed" });
        }
    }
);

export default router;