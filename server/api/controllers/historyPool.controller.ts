import { Request, Response } from "express";
import { storage } from "../../storage.js";

export const getHistoryPool = async (req: Request, res: Response) => {
  try {
    const employerId = req.companyId ?? req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const pool = await storage.getFreelancerHistoryPool(employerId);
    return res.json(pool);
  } catch (error: any) {
    console.error("getHistoryPool error:", error.message, error.stack);
    return res.status(500).json({ error: "Internal server error" });
  }
};
