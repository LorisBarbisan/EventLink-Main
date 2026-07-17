import type { Request, Response } from "express";
import { storage } from "../../storage";
import path from "path";
import { randomUUID } from "crypto";
import { ObjectStorageService, ObjectNotFoundError } from "../utils/object-storage";

export async function getPortfolioPosts(req: Request, res: Response) {
  try {
    const userId = parseInt(req.query.userId as string);
    if (isNaN(userId)) return res.status(400).json({ error: "Invalid userId" });
    const posts = await storage.getPortfolioPosts(userId);
    return res.json(posts);
  } catch (err) {
    console.error("getPortfolioPosts error:", err);
    return res.status(500).json({ error: "Failed to load portfolio" });
  }
}

export async function createPortfolioPost(req: Request, res: Response) {
  const user = (req as any).user;
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  if (user.subscription_tier !== "pro") {
    return res.status(403).json({ error: "Portfolio requires Pro subscription" });
  }
  const { type, title, body, media_url, thumbnail_url } = req.body;
  if (!type || !["photo", "video", "blog", "link"].includes(type)) {
    return res.status(400).json({ error: "Invalid post type" });
  }
  const post = await storage.createPortfolioPost({
    user_id: user.id,
    type,
    title: title || null,
    body: body || null,
    media_url: media_url || null,
    thumbnail_url: thumbnail_url || null,
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
    const ext = path.extname(file.originalname).toLowerCase();
    const key = `portfolio/${user.id}/${randomUUID()}${ext}`;
    await ObjectStorageService.uploadBuffer(key, file.mimetype, file.buffer);
    const url = `/api/portfolio/file/${key}`;
    return res.json({ url });
  } catch (err) {
    console.error("uploadPortfolioFile error:", err);
    return res.status(500).json({ error: "Upload failed" });
  }
}

export async function servePortfolioFile(req: Request, res: Response) {
  const key = (req.params as any)[0] as string;
  if (!key) return res.status(400).json({ error: "Missing key" });
  try {
    const svc = new ObjectStorageService();
    await svc.downloadObject(key, res, 86400);
  } catch (err) {
    if (err instanceof ObjectNotFoundError) return res.status(404).json({ error: "Not found" });
    return res.status(500).json({ error: "Serve failed" });
  }
}
