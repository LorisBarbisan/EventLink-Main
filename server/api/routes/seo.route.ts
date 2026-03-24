import type { Express, Request, Response } from "express";
import { storage } from "../../storage";

const BASE_URL = "https://eventlink.one";

export function registerSeoRoutes(app: Express) {
  // Dynamic sitemap.xml — helps Google discover all pages on the site
  app.get("/sitemap.xml", async (_req: Request, res: Response) => {
    try {
      const [allProfiles, allJobs] = await Promise.all([
        storage.getAllFreelancerProfiles(),
        storage.getAllJobs(),
      ]);

      const now = new Date().toISOString().split("T")[0];

      const staticPages = [
        { url: `${BASE_URL}/`, priority: "1.0" },
        { url: `${BASE_URL}/jobs`, priority: "0.9" },
        { url: `${BASE_URL}/freelancers`, priority: "0.9" },
        { url: `${BASE_URL}/how-it-works`, priority: "0.7" },
        { url: `${BASE_URL}/about`, priority: "0.6" },
        { url: `${BASE_URL}/faq`, priority: "0.5" },
        { url: `${BASE_URL}/contact-us`, priority: "0.4" },
      ];

      // Individual job pages — use slug URL if available, else numeric ID
      const jobPages = allJobs
        .filter(j => j.status === "active" && j.type !== "external")
        .map(j => ({
          url: j.slug ? `${BASE_URL}/jobs/${j.slug}` : `${BASE_URL}/jobs/${j.id}`,
          priority: "0.8",
          lastmod: j.updated_at ? new Date(j.updated_at).toISOString().split("T")[0] : now,
        }));

      // Individual freelancer profile pages — use canonical /profile/:userId URL
      const profilePages = allProfiles.map(p => ({
        url: `${BASE_URL}/profile/${p.user_id}`,
        priority: "0.7",
        lastmod: p.updated_at ? new Date(p.updated_at).toISOString().split("T")[0] : now,
      }));

      const allEntries = [...staticPages, ...jobPages, ...profilePages];

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries
  .map(
    e => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${(e as any).lastmod || now}</lastmod>
    <priority>${e.priority}</priority>
  </url>`
  )
  .join("\n")}
</urlset>`;

      res.set("Content-Type", "application/xml");
      res.set("Cache-Control", "public, max-age=3600");
      res.send(xml);
    } catch (err) {
      console.error("Sitemap generation error:", err);
      res.status(500).send("Error generating sitemap");
    }
  });

  // API: get job by slug — used by JobDetail page for slug-based URLs in sitemap
  app.get("/api/jobs/by-slug/:slug", async (req: Request, res: Response) => {
    try {
      const job = await storage.getJobBySlug(req.params.slug);
      if (!job) return res.status(404).json({ error: "Job not found" });
      res.json(job);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });
}
