import type { Express, Request, Response } from "express";
import { storage } from "../../storage";

const BASE_URL = "https://eventlink.one";

const ROLE_SLUGS = [
  "sound-engineer",
  "lighting-technician",
  "production-manager",
  "stage-manager",
  "av-technician",
  "rigger",
  "video-technician",
  "event-manager",
  "technical-director",
  "broadcast-technician",
];

const LOCATION_CITIES = [
  "london",
  "manchester",
  "birmingham",
  "bristol",
  "leeds",
  "glasgow",
  "edinburgh",
  "liverpool",
  "sheffield",
  "nottingham",
];

export function registerSeoRoutes(app: Express) {
  // Dynamic sitemap.xml
  app.get("/sitemap.xml", async (_req: Request, res: Response) => {
    try {
      const [allProfiles, allJobs, allEmployers] = await Promise.all([
        storage.getAllFreelancerProfiles(),
        storage.getAllJobs(),
        storage.getAllRecruiterProfiles(),
      ]);

      const now = new Date().toISOString();

      const staticPages = [
        { url: `${BASE_URL}/`, priority: "1.0" },
        { url: `${BASE_URL}/about`, priority: "0.5" },
        { url: `${BASE_URL}/jobs`, priority: "0.9" },
        { url: `${BASE_URL}/freelancers`, priority: "0.9" },
        { url: `${BASE_URL}/how-it-works`, priority: "0.6" },
        { url: `${BASE_URL}/faq`, priority: "0.5" },
        { url: `${BASE_URL}/contact-us`, priority: "0.4" },
      ];

      const rolePages = ROLE_SLUGS.map(slug => ({
        url: `${BASE_URL}/roles/${slug}`,
        priority: "0.8",
      }));

      const locationPages = LOCATION_CITIES.map(city => ({
        url: `${BASE_URL}/locations/${city}`,
        priority: "0.8",
      }));

      const profilePages = allProfiles
        .filter(p => p.slug)
        .map(p => ({ url: `${BASE_URL}/freelancers/${p.slug}`, priority: "0.7" }));

      const jobPages = allJobs
        .filter(j => j.slug && j.status === "active" && j.type !== "external")
        .map(j => ({ url: `${BASE_URL}/jobs/${j.slug}`, priority: "0.7" }));

      const employerPages = allEmployers
        .filter((e: any) => e.slug)
        .map((e: any) => ({ url: `${BASE_URL}/employers/${e.slug}`, priority: "0.6" }));

      const allEntries = [
        ...staticPages,
        ...rolePages,
        ...locationPages,
        ...profilePages,
        ...jobPages,
        ...employerPages,
      ];

      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${allEntries
  .map(
    e => `  <url>
    <loc>${e.url}</loc>
    <lastmod>${now.split("T")[0]}</lastmod>
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

  // API: get freelancer by slug
  app.get("/api/freelancers/by-slug/:slug", async (req: Request, res: Response) => {
    try {
      const profile = await storage.getFreelancerProfileBySlug(req.params.slug);
      if (!profile) return res.status(404).json({ error: "Profile not found" });
      res.json(profile);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // API: get job by slug
  app.get("/api/jobs/by-slug/:slug", async (req: Request, res: Response) => {
    try {
      const job = await storage.getJobBySlug(req.params.slug);
      if (!job) return res.status(404).json({ error: "Job not found" });
      res.json(job);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // API: get employer by slug
  app.get("/api/employers/by-slug/:slug", async (req: Request, res: Response) => {
    try {
      const profile = await storage.getRecruiterProfileBySlug(req.params.slug);
      if (!profile) return res.status(404).json({ error: "Employer not found" });
      const user = await storage.getUser(profile.user_id);
      const jobs = await storage.getJobsByRecruiterId(profile.user_id);
      res.json({ profile, user: user ? { id: user.id, first_name: user.first_name, last_name: user.last_name } : null, jobs: jobs.filter(j => j.status === "active") });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // API: get all employers (public fields only)
  app.get("/api/employers", async (_req: Request, res: Response) => {
    try {
      const employers = await storage.getAllRecruiterProfilesWithUser();
      const safe = employers.map(({ profile, user }) => ({
        profile,
        user: { id: user.id, first_name: user.first_name, last_name: user.last_name },
      }));
      res.json(safe);
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // API: role page data
  app.get("/api/seo/roles/:role", async (req: Request, res: Response) => {
    try {
      const role = req.params.role.replace(/-/g, " ");
      const [freelancers, roleJobs] = await Promise.all([
        storage.getFreelancersByRole(role, 20),
        storage.getJobsByRole(role, 10),
      ]);
      res.json({ freelancers, jobs: roleJobs });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });

  // API: location page data
  app.get("/api/seo/locations/:city", async (req: Request, res: Response) => {
    try {
      const city = req.params.city;
      const [freelancers, cityJobs] = await Promise.all([
        storage.getFreelancersByLocation(city, 20),
        storage.getJobsByLocation(city, 10),
      ]);
      res.json({ freelancers, jobs: cityJobs });
    } catch (err) {
      res.status(500).json({ error: "Server error" });
    }
  });
}
