import type { Request, Response } from "express";
import { storage } from "../../storage";

export async function saveFreelancer(req: Request, res: Response) {
  try {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if ((req as any).user.role !== "recruiter" && (req as any).user.role !== "admin") {
      return res.status(403).json({ error: "Only employers can save freelancers" });
    }

    const { freelancerId } = req.body;
    if (!freelancerId || typeof freelancerId !== "number") {
      return res.status(400).json({ error: "freelancerId is required" });
    }

    const result = await storage.saveFreelancer((req as any).user.id, freelancerId);
    res.json(result);
  } catch (error) {
    console.error("Error saving freelancer:", error);
    res.status(500).json({ error: "Failed to save freelancer" });
  }
}

export async function unsaveFreelancer(req: Request, res: Response) {
  try {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if ((req as any).user.role !== "recruiter" && (req as any).user.role !== "admin") {
      return res.status(403).json({ error: "Only employers can unsave freelancers" });
    }

    const freelancerId = parseInt(req.params.freelancerId, 10);
    if (isNaN(freelancerId)) {
      return res.status(400).json({ error: "Invalid freelancer ID" });
    }

    await storage.unsaveFreelancer((req as any).user.id, freelancerId);
    res.json({ success: true });
  } catch (error) {
    console.error("Error unsaving freelancer:", error);
    res.status(500).json({ error: "Failed to unsave freelancer" });
  }
}

export async function getSavedFreelancerIds(req: Request, res: Response) {
  try {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const ids = await storage.getSavedFreelancerIds((req as any).user.id);
    res.json(ids);
  } catch (error) {
    console.error("Error getting saved freelancer IDs:", error);
    res.status(500).json({ error: "Failed to get saved freelancers" });
  }
}

export async function getMyCrewFreelancers(req: Request, res: Response) {
  try {
    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }
    if ((req as any).user.role !== "recruiter" && (req as any).user.role !== "admin") {
      return res.status(403).json({ error: "Only employers can access My Crew" });
    }

    const keyword = req.query.keyword as string | undefined;
    const location = req.query.location as string | undefined;
    const tab = (req.query.tab as "all" | "saved" | "worked") || "all";

    const results = await storage.getMyCrewFreelancers((req as any).user.id, {
      keyword,
      location,
      tab,
    });

    res.json(results);
  } catch (error) {
    console.error("Error getting My Crew freelancers:", error);
    res.status(500).json({ error: "Failed to get crew" });
  }
}
