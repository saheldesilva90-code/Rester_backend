import { Request, Response } from "express";
import {
    createNote,
    getNoteByUserId,
    updateNote,
    deleteNote,
} from "../db/queries";

// Only fields that actually exist in the schema and are needed.
// songAudioUrl is intentionally excluded — we never write it.
// songPreviewUrl is kept so it saves to DB (harmless, never used for playback).
function extractNoteFields(body: any) {
    return {
        content: body.content ?? null,
        songTitle: body.songTitle ?? null,
        songArtist: body.songArtist ?? null,
        songAlbumArt: body.songAlbumArt ?? null,
        songPreviewUrl: body.songPreviewUrl ?? null,
        songClipStartMs: body.songClipStartMs ? String(body.songClipStartMs) : null,
        songTrackId: body.songTrackId ? Number(body.songTrackId) : null,
    };
}

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