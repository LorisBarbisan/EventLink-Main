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

// GET /api/earnings/clients — list client names for autocomplete
router.get("/clients", auth, async (req: Request, res: Response) => {
  try {
    const clients = await storage.listEarningsClients(req.user!.id);
    return res.json(clients);
  } catch (err) {
    console.error("earnings clients error:", err);
    return res.status(500).json({ error: "Failed to load clients" });
  }
});

// POST /api/earnings — create a manual gig entry
router.post("/", auth, async (req: Request, res: Response) => {
  try {
    const freelancerId = req.user!.id;
    const {
      description,
      client_name,
      work_date,
      work_end_date,
      unit = "day",
      quantity = 1,
      gross_amount,
      currency = "GBP",
      status = "expected",
      paid_date,
      notes,
    } = req.body;

    if (!description || !work_date || gross_amount == null) {
      return res
        .status(400)
        .json({ error: "description, work_date and gross_amount are required" });
    }

    const grossPence = Math.round(Number(gross_amount) * 100);
    if (isNaN(grossPence)) return res.status(400).json({ error: "Invalid gross_amount" });

    // Resolve or create client
    let clientId: number | null = null;
    if (client_name?.trim()) {
      const client = await storage.findOrCreateClientByName(freelancerId, client_name.trim());
      clientId = client.id;
    }

    const entry = await storage.createEarningsEntry({
      freelancer_id: freelancerId,
      client_id: clientId,
      source: "manual",
      description,
      work_date,
      work_end_date: work_end_date ?? null,
      quantity: String(quantity),
      unit,
      gross_amount_pence: grossPence,
      currency,
      status,
      paid_date: paid_date ?? null,
      notes: notes ?? null,
      needs_review: false,
      archived: false,
    });

    return res.status(201).json(entry);
  } catch (err) {
    console.error("create earnings entry error:", err);
    return res.status(500).json({ error: "Failed to create entry" });
  }
});

// PATCH /api/earnings/:id — update a manual entry
router.patch("/:id", auth, async (req: Request, res: Response) => {
  try {
    const freelancerId = req.user!.id;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    // Ownership check via the summary entries list
    const existing = await storage.getEarningsEntry(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.freelancer_id !== freelancerId)
      return res.status(403).json({ error: "Forbidden" });

    const {
      description,
      client_name,
      work_date,
      work_end_date,
      unit,
      quantity,
      gross_amount,
      currency,
      status,
      paid_date,
      notes,
    } = req.body;

    const updates: Record<string, unknown> = {};
    if (description !== undefined) updates.description = description;
    if (work_date !== undefined) updates.work_date = work_date;
    if (work_end_date !== undefined) updates.work_end_date = work_end_date;
    if (unit !== undefined) updates.unit = unit;
    if (quantity !== undefined) updates.quantity = String(quantity);
    if (gross_amount !== undefined)
      updates.gross_amount_pence = Math.round(Number(gross_amount) * 100);
    if (currency !== undefined) updates.currency = currency;
    if (status !== undefined) updates.status = status;
    if (paid_date !== undefined) updates.paid_date = paid_date;
    if (notes !== undefined) updates.notes = notes;

    if (client_name !== undefined) {
      if (client_name?.trim()) {
        const client = await storage.findOrCreateClientByName(freelancerId, client_name.trim());
        updates.client_id = client.id;
      } else {
        updates.client_id = null;
      }
    }

    const updated = await storage.updateEarningsEntry(
      id,
      updates as Parameters<typeof storage.updateEarningsEntry>[1]
    );
    return res.json(updated);
  } catch (err) {
    console.error("update earnings entry error:", err);
    return res.status(500).json({ error: "Failed to update entry" });
  }
});

// DELETE /api/earnings/:id/archive — soft-delete a manual entry
router.delete("/:id/archive", auth, async (req: Request, res: Response) => {
  try {
    const freelancerId = req.user!.id;
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

    const existing = await storage.getEarningsEntry(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.freelancer_id !== freelancerId)
      return res.status(403).json({ error: "Forbidden" });
    if (existing.source !== "manual") {
      return res.status(409).json({ error: "Only manual entries can be deleted" });
    }

    await storage.updateEarningsEntry(id, { archived: true });
    return res.json({ ok: true });
  } catch (err) {
    console.error("archive earnings entry error:", err);
    return res.status(500).json({ error: "Failed to archive entry" });
  }
});

export default router;
