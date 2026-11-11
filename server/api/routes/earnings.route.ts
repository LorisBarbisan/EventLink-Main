import { Router } from "express";
import { authenticateJWT } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/role.middleware";
import { backfillEarningsForFreelancer } from "../services/earnings.service";
import { storage, normaliseClientName } from "../../storage";
import { currentTaxYear } from "@shared/tax-periods";
import type { Request, Response } from "express";
import {
  listTimeEntries,
  upsertTimeEntry,
  deleteTimeEntry,
  getOvertimeSummary,
  updateOvertimeSettings,
} from "../controllers/time-entries.controller";

const router = Router();
const auth = [authenticateJWT, requireRole("freelancer")];

// GET /api/earnings/jobs — lightweight job list for the expense/mileage selectors
router.get("/jobs", auth, async (req: Request, res: Response) => {
  try {
    const jobs = await storage.listJobsForSelector(req.user!.id);
    return res.json(jobs);
  } catch (err) {
    console.error("earnings jobs error:", err);
    return res.status(500).json({ error: "Failed to load jobs" });
  }
});

// GET /api/earnings/gigs?from=YYYY-MM-DD&to=YYYY-MM-DD
// Returns scheduled gig entries (work_status IS NOT NULL) in range, for the calendar and My Jobs.
router.get("/gigs", auth, async (req: Request, res: Response) => {
  try {
    const freelancerId = req.user!.id;
    const { from, to } = req.query as { from?: string; to?: string };
    if (!from || !to) return res.status(400).json({ error: "from and to are required" });
    const gigs = await storage.listEarningsGigs(freelancerId, from, to);
    return res.json(gigs);
  } catch (err) {
    console.error("earnings gigs error:", err);
    return res.status(500).json({ error: "Failed to load gigs" });
  }
});

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

// POST /api/earnings/clients/match — check for near-match before saving
// Body: { name: string }  Returns: { exact, near } — both nullable client objects
router.post("/clients/match", auth, async (req: Request, res: Response) => {
  try {
    const { name } = req.body as { name?: string };
    if (!name?.trim()) return res.status(400).json({ error: "name required" });
    const result = await storage.findNearMatchClient(req.user!.id, name.trim());
    return res.json(result);
  } catch (err) {
    console.error("client match error:", err);
    return res.status(500).json({ error: "Failed to check" });
  }
});

// POST /api/earnings/clients/backfill — seed earnings_clients from existing invoices
router.post("/clients/backfill", auth, async (req: Request, res: Response) => {
  try {
    const result = await storage.backfillClientsFromInvoices(req.user!.id);
    return res.json(result);
  } catch (err) {
    console.error("client backfill error:", err);
    return res.status(500).json({ error: "Backfill failed" });
  }
});

// GET /api/earnings/clients — list clients (with stats when ?stats=1)
router.get("/clients", auth, async (req: Request, res: Response) => {
  try {
    if (req.query.stats === "1") {
      const clients = await storage.listClientsWithStats(req.user!.id);
      return res.json(clients);
    }
    const clients = await storage.listEarningsClients(req.user!.id);
    return res.json(clients);
  } catch (err) {
    console.error("earnings clients error:", err);
    return res.status(500).json({ error: "Failed to load clients" });
  }
});

// POST /api/earnings/clients — create a client
router.post("/clients", auth, async (req: Request, res: Response) => {
  try {
    const {
      name,
      contact_name,
      contact_email,
      accounts_email,
      address_line1,
      address_line2,
      city,
      postcode,
      country,
      payment_terms_days,
      requires_po,
      vat_number,
      notes,
    } = req.body as Record<string, unknown>;
    if (!name || typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name required" });
    }
    const client = await storage.createEarningsClient({
      freelancer_id: req.user!.id,
      name: (name as string).trim(),
      normalised_name: normaliseClientName((name as string).trim()),
      contact_name: (contact_name as string | undefined) ?? null,
      contact_email: (contact_email as string | undefined) ?? null,
      accounts_email: (accounts_email as string | undefined) ?? null,
      address_line1: (address_line1 as string | undefined) ?? null,
      address_line2: (address_line2 as string | undefined) ?? null,
      city: (city as string | undefined) ?? null,
      postcode: (postcode as string | undefined) ?? null,
      country: (country as string | undefined) ?? null,
      payment_terms_days: typeof payment_terms_days === "number" ? payment_terms_days : null,
      requires_po: requires_po === true,
      vat_number: (vat_number as string | undefined) ?? null,
      notes: (notes as string | undefined) ?? null,
    });
    return res.status(201).json(client);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "Client already exists" });
    console.error("create client error:", err);
    return res.status(500).json({ error: "Failed to create client" });
  }
});

// PATCH /api/earnings/clients/:id — update a client
router.patch("/clients/:id", auth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const existing = await storage.getEarningsClient(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.freelancer_id !== req.user!.id)
      return res.status(403).json({ error: "Forbidden" });

    const {
      name,
      contact_name,
      contact_email,
      accounts_email,
      address_line1,
      address_line2,
      city,
      postcode,
      country,
      payment_terms_days,
      requires_po,
      vat_number,
      notes,
    } = req.body as Record<string, unknown>;

    const patch: Record<string, unknown> = {};
    if (name !== undefined) {
      patch.name = (name as string).trim();
      patch.normalised_name = normaliseClientName((name as string).trim());
    }
    if (contact_name !== undefined) patch.contact_name = contact_name ?? null;
    if (contact_email !== undefined) patch.contact_email = contact_email ?? null;
    if (accounts_email !== undefined) patch.accounts_email = accounts_email ?? null;
    if (address_line1 !== undefined) patch.address_line1 = address_line1 ?? null;
    if (address_line2 !== undefined) patch.address_line2 = address_line2 ?? null;
    if (city !== undefined) patch.city = city ?? null;
    if (postcode !== undefined) patch.postcode = postcode ?? null;
    if (country !== undefined) patch.country = country ?? null;
    if (payment_terms_days !== undefined) patch.payment_terms_days = payment_terms_days ?? null;
    if (requires_po !== undefined) patch.requires_po = requires_po === true;
    if (vat_number !== undefined) patch.vat_number = vat_number ?? null;
    if (notes !== undefined) patch.notes = notes ?? null;

    const updated = await storage.updateEarningsClient(id, patch as any);
    return res.json(updated);
  } catch (err: any) {
    if (err?.code === "23505") return res.status(409).json({ error: "Client name already exists" });
    console.error("update client error:", err);
    return res.status(500).json({ error: "Failed to update client" });
  }
});

// DELETE /api/earnings/clients/:id — archive a client
router.delete("/clients/:id", auth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const existing = await storage.getEarningsClient(id);
    if (!existing) return res.status(404).json({ error: "Not found" });
    if (existing.freelancer_id !== req.user!.id)
      return res.status(403).json({ error: "Forbidden" });
    const archived = await storage.archiveEarningsClient(id);
    return res.json(archived);
  } catch (err) {
    console.error("archive client error:", err);
    return res.status(500).json({ error: "Failed to archive client" });
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
      job_application_id,
      work_status,
      call_time,
      venue_address,
      role_id,
      venue,
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
      work_status: work_status ?? null,
      call_time: call_time ?? null,
      venue_address: venue_address ?? null,
      role_id: role_id ?? null,
      venue: venue ?? null,
    });

    // Link back to the job application if provided
    if (job_application_id) {
      await storage.linkJobApplicationEarning(Number(job_application_id), entry.id);
    }

    return res.status(201).json(entry);
  } catch (err) {
    console.error("create earnings entry error:", err);
    return res.status(500).json({ error: "Failed to create entry" });
  }
});

// GET /api/earnings/:id — single entry (job detail page)
router.get("/:id", auth, async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
    const entry = await storage.getEarningsEntry(id);
    if (!entry || entry.freelancer_id !== req.user!.id)
      return res.status(404).json({ error: "Not found" });
    return res.json(entry);
  } catch (err) {
    console.error("get earnings entry error:", err);
    return res.status(500).json({ error: "Failed to load entry" });
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
      work_status,
      call_time,
      venue_address,
      role_id,
      venue,
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
    if (work_status !== undefined) updates.work_status = work_status;
    if (call_time !== undefined) updates.call_time = call_time;
    if (venue_address !== undefined) updates.venue_address = venue_address;
    if (role_id !== undefined) updates.role_id = role_id;
    if (venue !== undefined) updates.venue = venue;

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

// ── Time entries & overtime ───────────────────────────────────────────────────
// GET  /api/earnings/entries/:entryId/time          — list all days logged
// POST /api/earnings/entries/:entryId/time          — upsert a day (by date)
// DELETE /api/earnings/entries/:entryId/time/:id    — remove a day
// GET  /api/earnings/entries/:entryId/time/summary  — overtime calculation
// PATCH /api/earnings/entries/:entryId/overtime     — update settings

router.get("/entries/:entryId/time", auth, async (req: Request, res: Response) => {
  try {
    return await listTimeEntries(req, res);
  } catch (err) {
    console.error("list time entries error:", err);
    return res.status(500).json({ error: "Failed to load time entries" });
  }
});

router.post("/entries/:entryId/time", auth, async (req: Request, res: Response) => {
  try {
    return await upsertTimeEntry(req, res);
  } catch (err) {
    console.error("upsert time entry error:", err);
    return res.status(500).json({ error: "Failed to save time entry" });
  }
});

router.delete("/entries/:entryId/time/:id", auth, async (req: Request, res: Response) => {
  try {
    return await deleteTimeEntry(req, res);
  } catch (err) {
    console.error("delete time entry error:", err);
    return res.status(500).json({ error: "Failed to delete time entry" });
  }
});

router.get("/entries/:entryId/time/summary", auth, async (req: Request, res: Response) => {
  try {
    return await getOvertimeSummary(req, res);
  } catch (err) {
    console.error("overtime summary error:", err);
    return res.status(500).json({ error: "Failed to compute summary" });
  }
});

router.patch("/entries/:entryId/overtime", auth, async (req: Request, res: Response) => {
  try {
    return await updateOvertimeSettings(req, res);
  } catch (err) {
    console.error("overtime settings error:", err);
    return res.status(500).json({ error: "Failed to update overtime settings" });
  }
});

export default router;
