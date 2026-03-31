import { Request, Response } from "express";
import {
    createNote,
    getNoteById,
    getNoteByUserId,
    updateNote,
    deleteNote,
} from "../db/queries";

export const createMyNote = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const {
            content,
            songTitle,
            songArtist,
            songAlbumArt,
            songPreviewUrl,
            songClipStartMs,
            songTrackId,
            songAudioUrl,
        } = req.body;

        if (!content && !songTitle) {
            res.status(400).json({ success: false, message: "Note must have text or a song" });
            return;
        }

        const note = await createNote({
            userId,
            content: content ?? null,
            songTitle: songTitle ?? null,
            songArtist: songArtist ?? null,
            songAlbumArt: songAlbumArt ?? null,
            songPreviewUrl: songPreviewUrl ?? null,
            songClipStartMs: songClipStartMs ? String(songClipStartMs) : null,
            songTrackId: songTrackId ?? null,
            songAudioUrl: songAudioUrl ?? null,
        });

        res.status(201).json({ success: true, data: { note } });
    } catch (error) {
        console.error("Create note error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getMyNote = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const note = await getNoteByUserId(userId);
        res.status(200).json({ success: true, data: { note } });
    } catch (error) {
        console.error("Get note error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUserNote = async (req: Request, res: Response) => {
    try {
        const userId = String(req.params.userId);
        const note = await getNoteByUserId(userId);
        res.status(200).json({ success: true, data: { note } });
    } catch (error) {
        console.error("Get user note error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const updateMyNote = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const {
            content,
            songTitle,
            songArtist,
            songAlbumArt,
            songPreviewUrl,
            songClipStartMs,
            songTrackId,
            songAudioUrl,
        } = req.body;

        const existing = await getNoteByUserId(userId);
        if (!existing) {
            res.status(404).json({ success: false, message: "Note not found" });
            return;
        }

        const note = await updateNote(existing.id, {
            content: content ?? null,
            songTitle: songTitle ?? null,
            songArtist: songArtist ?? null,
            songAlbumArt: songAlbumArt ?? null,
            songPreviewUrl: songPreviewUrl ?? null,
            songClipStartMs: songClipStartMs ? String(songClipStartMs) : null,
            songTrackId: songTrackId ?? null,
            songAudioUrl: songAudioUrl ?? null,
        });

        res.status(200).json({ success: true, data: { note } });
    } catch (error) {
        console.error("Update note error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const deleteMyNote = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const existing = await getNoteByUserId(userId);
        if (!existing) {
            res.status(404).json({ success: false, message: "Note not found" });
            return;
        }
        await deleteNote(existing.id, userId);
        res.status(200).json({ success: true, message: "Note deleted" });
    } catch (error) {
        console.error("Delete note error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const upsertMyNote = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const {
            content,
            songTitle,
            songArtist,
            songAlbumArt,
            songPreviewUrl,
            songClipStartMs,
            songTrackId,
            songAudioUrl,
        } = req.body;

        if (!content && !songTitle) {
            res.status(400).json({ success: false, message: "Note must have text or a song" });
            return;
        }

        const existing = await getNoteByUserId(userId);

        if (existing) {
            const note = await updateNote(existing.id, {
                content: content ?? null,
                songTitle: songTitle ?? null,
                songArtist: songArtist ?? null,
                songAlbumArt: songAlbumArt ?? null,
                songPreviewUrl: songPreviewUrl ?? null,
                songClipStartMs: songClipStartMs ? String(songClipStartMs) : null,
                songTrackId: songTrackId ?? null,
                songAudioUrl: songAudioUrl ?? null,
            });
            res.status(200).json({ success: true, data: { note } });
        } else {
            const note = await createNote({
                userId,
                content: content ?? null,
                songTitle: songTitle ?? null,
                songArtist: songArtist ?? null,
                songAlbumArt: songAlbumArt ?? null,
                songPreviewUrl: songPreviewUrl ?? null,
                songClipStartMs: songClipStartMs ? String(songClipStartMs) : null,
                songTrackId: songTrackId ?? null,
                songAudioUrl: songAudioUrl ?? null,
            });
            res.status(201).json({ success: true, data: { note } });
        }
    } catch (error) {
        console.error("Upsert note error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};