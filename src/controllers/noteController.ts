import { Request, Response } from "express";
import {
    createNote,
    getNoteByUserId,
    updateNote,
    deleteNote,
} from "../db/queries";

// ─── Helper ───────────────────────────────────────────────────────────────────
// Extracts only the fields we actually store.
// songAudioUrl is intentionally removed — we no longer store or use it.
// songPreviewUrl is kept so existing notes that have it don't break,
// but it is never used for playback (frontend always calls /api/audio/url/:trackId).
function extractNoteFields(body: any) {
    return {
        content: body.content ?? null,
        songTitle: body.songTitle ?? null,
        songArtist: body.songArtist ?? null,
        songAlbumArt: body.songAlbumArt ?? null,
        songPreviewUrl: body.songPreviewUrl ?? null,
        songClipStartMs: body.songClipStartMs ? String(body.songClipStartMs) : null,
        songTrackId: body.songTrackId ?? null,
    };
}

// ─── Controllers ──────────────────────────────────────────────────────────────

export const getMyNote = async (req: Request, res: Response) => {
    try {
        const note = await getNoteByUserId(req.user.id);
        res.status(200).json({ success: true, data: { note } });
    } catch (error) {
        console.error("Get note error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const getUserNote = async (req: Request, res: Response) => {
    try {
        const note = await getNoteByUserId(String(req.params.userId));
        res.status(200).json({ success: true, data: { note } });
    } catch (error) {
        console.error("Get user note error:", error);
        res.status(500).json({ success: false, message: "Internal server error" });
    }
};

export const upsertMyNote = async (req: Request, res: Response) => {
    try {
        const userId = req.user.id;
        const fields = extractNoteFields(req.body);

        if (!fields.content && !fields.songTitle) {
            res.status(400).json({ success: false, message: "Note must have text or a song" });
            return;
        }

        const existing = await getNoteByUserId(userId);

        if (existing) {
            const note = await updateNote(existing.id, fields);
            res.status(200).json({ success: true, data: { note } });
        } else {
            const note = await createNote({ userId, ...fields });
            res.status(201).json({ success: true, data: { note } });
        }
    } catch (error) {
        console.error("Upsert note error:", error);
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