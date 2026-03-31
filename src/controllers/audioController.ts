import { Request, Response } from "express";

const urlCache = new Map<number, { url: string; fetchedAt: number }>();
const CACHE_TTL_MS = 2 * 60 * 1000;

async function getFreshDeezerUrl(trackId: number): Promise<string | null> {
    const cached = urlCache.get(trackId);
    if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
        return cached.url;
    }
    try {
        const res = await fetch(`https://api.deezer.com/track/${trackId}`);
        if (!res.ok) return null;
        const data = await res.json() as any;
        const url: string | null = data.preview ?? null;
        if (url) urlCache.set(trackId, { url, fetchedAt: Date.now() });
        return url;
    } catch (e) {
        console.log("Deezer fetch error:", e);
        return null;
    }
}

export const getAudioUrl = async (req: Request, res: Response) => {
    const trackId = Number(req.params.trackId);
    if (isNaN(trackId)) {
        return res.status(400).json({ success: false, message: "Invalid track ID" });
    }

    try {
        let url = await getFreshDeezerUrl(trackId);

        if (!url) {
            urlCache.delete(trackId);
            url = await getFreshDeezerUrl(trackId);
        }

        if (!url) {
            return res.status(404).json({ success: false, message: "Preview not available for this track" });
        }

        return res.status(200).json({ success: true, url });
    } catch (e: any) {
        console.error("Audio URL error:", e);
        return res.status(500).json({ success: false, message: "Failed to get audio URL" });
    }
};