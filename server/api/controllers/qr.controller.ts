import type { Request, Response } from "express";
import { storage } from "../../storage";

const FRONTEND_BASE = process.env.FRONTEND_URL || "https://app.eventlink.one";

export async function getProfileQR(req: Request, res: Response) {
  try {
    const userId = parseInt(req.params.userId, 10);
    if (isNaN(userId)) {
      return res.status(400).json({ error: "Invalid user ID" });
    }

    const profile = await storage.getFreelancerProfile(userId);
    const effectiveSlug = (profile as any)?.custom_slug || profile?.slug;
    const profileUrl = effectiveSlug
      ? `${FRONTEND_BASE}/profile/${effectiveSlug}`
      : `${FRONTEND_BASE}/profile/${userId}`;

    // Dynamic import so the server still starts even if qrcode isn't installed yet
    let QRCode: typeof import("qrcode");
    try {
      QRCode = await import("qrcode");
    } catch {
      return res.status(503).json({ error: "QR library not available — run npm install" });
    }

    const pngBuffer = await QRCode.toBuffer(profileUrl, {
      type: "png",
      width: 400,
      margin: 2,
      color: { dark: "#1a1a1a", light: "#ffffff" },
      errorCorrectionLevel: "M",
    });

    res.set("Content-Type", "image/png");
    res.set("Cache-Control", "public, max-age=3600");
    res.set("Content-Disposition", `inline; filename="eventlink-qr-${userId}.png"`);
    res.send(pngBuffer);
  } catch (error) {
    console.error("QR generation error:", error);
    res.status(500).json({ error: "Failed to generate QR code" });
  }
}
