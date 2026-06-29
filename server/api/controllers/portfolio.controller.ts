import type { Request, Response } from "express";
import { storage } from "../../storage";
import { promises as fs } from "fs";
import path from "path";
import { randomUUID } from "crypto";

const UPLOADS_DIR = path.join(process.cwd(), "uploads", "portfolio");

export async function getPortfolioPosts(req: Request, res: Response) {
  const userId = parseInt(req.query.userId as string);
  if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });
  const posts = await storage.getPortfolioPosts(userId);
  return res.json(posts);
}

export async function createPortfolioPost(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.subscription_tier !== "pro") {
    return res.status(403).json({ error: "Portfolio requires Pro subscription" });
  }
  const { type, title, body, media_url } = req.body;
  if (!type || !["photo", "video", "blog", "link"].includes(type)) {
    return res.status(400).json({ error: "Invalid post type" });
  }
  const post = await storage.createPortfolioPost({
    user_id: user.id,
    type,
    title: title || null,
    body: body || null,
    media_url: media_url || null,
    thumbnail_url: null,
  });
  return res.status(201).json(post);
}

export async function updatePortfolioPost(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const posts = await storage.getPortfolioPosts(user.id);
  if (!posts.find((p) => p.id === id)) {
    return res.status(403).json({ error: "Not your post" });
  }

  const { title, body, media_url } = req.body;
  const updated = await storage.updatePortfolioPost(id, {
    title: title ?? null,
    body: body ?? null,
    media_url: media_url ?? null,
  });
  return res.json(updated);
}

export async function deletePortfolioPost(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const posts = await storage.getPortfolioPosts(user.id);
  if (!posts.find((p) => p.id === id)) {
    return res.status(403).json({ error: "Not your post" });
  }

  await storage.deletePortfolioPost(id);
  return res.status(204).send();
}

export async function uploadPortfolioFile(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.subscription_tier !== "pro") {
    return res.status(403).json({ error: "Portfolio requires Pro subscription" });
  }

  const file = (req as any).file as Express.Multer.File | undefined;
  if (!file) return res.status(400).json({ error: "No file uploaded" });

  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true });
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${randomUUID()}${ext}`;
    const dest = path.join(UPLOADS_DIR, filename);
    await fs.writeFile(dest, file.buffer);
    const url = `/uploads/portfolio/${filename}`;
    return res.json({ url });
  } catch {
    return res.status(500).json({ error: "Upload failed" });
  }
}
