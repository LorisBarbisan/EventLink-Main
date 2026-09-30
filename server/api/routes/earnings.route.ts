import { Router } from "express";
import { authenticateJWT, requirePro } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { backfillEarningsForFreelancer } from "../services/earnings.service";
import { storage } from "../../storage";
import { currentTaxYear } from "@shared/tax-periods";
import type { Request, Response } from "express";

const router = Router();
const auth = [authenticateJWT, requirePro, requireRole("freelancer")];

// GET /api/earnings/summary
// Returns: this-tax-year totals, owed-to-me list, and paginated full log
router.get("/summary", auth, async (req: Request, res: Response) => {
  try {
    const freelancerId = req.user!.id;
    const basis = (req.query.basis as "cash" | "accruals") ?? "cash";
    const ty = currentTaxYear();

    const [summary, owedEntries, allEntries] = await Promise.all([
      storage.earningsSummary(freelancerId, {
        basis,
        from: ty.from,
        to: ty.to,
        groupBy: "month",
      }),
      // Owed = invoiced but not yet paid (invoice sent, entry status expected/invoiced)
      storage
        .listEarningsEntries(freelancerId, { archived: false })
        .then((entries) =>
          entries.filter(
            (e) => e.invoice_id !== null && e.status !== "paid" && e.status !== "expected"
          )
        ),
      storage.listEarningsEntries(freelancerId, { archived: false }),
    ]);

    return res.json({
      tax_year: ty,
      basis,
      summary,
      owed: owedEntries,
      entries: allEntries,
    });
  } catch (err) {
    console.error("earnings summary error:", err);
    return res.status(500).json({ error: "Failed to load earnings" });
  }
});

// POST /api/earnings/backfill
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
