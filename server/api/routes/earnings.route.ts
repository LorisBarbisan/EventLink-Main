import { Router } from "express";
import { authenticateJWT, requirePro } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { backfillEarningsForFreelancer } from "../services/earnings.service";
import type { Request, Response } from "express";

const router = Router();
const auth = [authenticateJWT, requirePro, requireRole("freelancer")];

router.post("/backfill", auth, async (req: Request, res: Response) => {
  try {
    const freelancerId = req.user!.id;
    const result = await backfillEarningsForFreelancer(freelancerId);
    return res.json(result);
  } catch (err) {
    console.error("earnings backfill error:", err);
    return res.status(500).json({ error: "Backfill failed" });
  }
});

export default router;
