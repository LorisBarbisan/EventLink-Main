import type { Request, Response } from "express";
import { storage } from "../../storage";
import { currentTaxYear } from "@shared/tax-periods";

function taxYearParams(req: Request): { from: string; to: string } {
  const ty = currentTaxYear();
  return {
    from: (req.query.from as string) ?? ty.from,
    to: (req.query.to as string) ?? ty.to,
  };
}

// ── Rate lookup ───────────────────────────────────────────────────────────────

export async function getRate(req: Request, res: Response) {
  const vehicleType = (req.query.vehicle_type as string) ?? "car";
  const tripDate = (req.query.trip_date as string) ?? new Date().toISOString().slice(0, 10);
  const rate = await storage.getActiveRates(vehicleType, tripDate);
  if (!rate) return res.status(404).json({ error: "No rate found" });
  return res.json(rate);
}

// ── Saved places ──────────────────────────────────────────────────────────────

export async function listSavedPlaces(req: Request, res: Response) {
  const rows = await storage.listSavedPlaces(req.user!.id);
  return res.json(rows);
}

export async function createSavedPlace(req: Request, res: Response) {
  const { label, address } = req.body;
  if (!label?.trim()) return res.status(400).json({ error: "label is required" });
  const row = await storage.createSavedPlace({
    freelancer_id: req.user!.id,
    label: label.trim(),
    address: address?.trim() || null,
  });
  return res.status(201).json(row);
}

export async function deleteSavedPlace(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await storage.deleteSavedPlace(id, req.user!.id);
  return res.status(204).send();
}

// ── Trips ─────────────────────────────────────────────────────────────────────

export async function listTrips(req: Request, res: Response) {
  const { from, to } = taxYearParams(req);
  const rows = await storage.listMileageTrips(req.user!.id, from, to);
  const total_pence = await storage.sumMileagePence(req.user!.id, from, to);
  return res.json({ trips: rows, total_pence });
}

export async function createTrip(req: Request, res: Response) {
  const freelancerId = req.user!.id;
  const {
    trip_date,
    from_place,
    to_place,
    miles,
    purpose,
    vehicle_type = "car",
    booking_id,
    notes,
  } = req.body;

  if (!trip_date || !from_place || !to_place || miles == null || !purpose) {
    return res
      .status(400)
      .json({ error: "trip_date, from_place, to_place, miles and purpose are required" });
  }

  const milesInt = parseInt(miles);
  if (isNaN(milesInt) || milesInt <= 0) {
    return res.status(400).json({ error: "miles must be a positive integer" });
  }

  // Look up the applicable rate
  const rate = await storage.getActiveRates(vehicle_type, trip_date);
  if (!rate)
    return res.status(422).json({ error: "No mileage rate found for this vehicle and date" });

  // Calculate pence (UK: 45p for first 10 000 miles in tax year for cars)
  // We calculate purely per-trip here; a future enhancement can track YTD miles
  const amount_pence = Math.round(milesInt * rate.rate_pence);

  const trip = await storage.createMileageTrip({
    freelancer_id: freelancerId,
    trip_date,
    from_place: from_place.trim(),
    to_place: to_place.trim(),
    miles: milesInt,
    purpose: purpose.trim(),
    vehicle_type,
    amount_pence,
    rate_pence: rate.rate_pence,
    rate_above_pence: rate.rate_above_pence ?? null,
    booking_id: booking_id ? Number(booking_id) : null,
    notes: notes?.trim() || null,
  });

  return res.status(201).json(trip);
}

export async function updateTrip(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const allowedFields = [
    "trip_date",
    "from_place",
    "to_place",
    "miles",
    "purpose",
    "vehicle_type",
    "booking_id",
    "notes",
  ] as const;
  const patch: Record<string, unknown> = {};
  for (const f of allowedFields) {
    if (req.body[f] !== undefined) patch[f] = req.body[f];
  }

  // Recalculate if miles or vehicle_type or trip_date changed
  if (
    patch.miles !== undefined ||
    patch.vehicle_type !== undefined ||
    patch.trip_date !== undefined
  ) {
    const existing = (
      await storage.listMileageTrips(req.user!.id, "2000-01-01", "2100-01-01")
    ).find((t) => t.id === id);
    if (existing) {
      const vehicleType = (patch.vehicle_type as string) ?? existing.vehicle_type;
      const tripDate = (patch.trip_date as string) ?? existing.trip_date;
      const milesInt = patch.miles !== undefined ? parseInt(patch.miles as string) : existing.miles;
      const rate = await storage.getActiveRates(vehicleType, tripDate);
      if (rate) {
        patch.amount_pence = Math.round(milesInt * rate.rate_pence);
        patch.rate_pence = rate.rate_pence;
        patch.rate_above_pence = rate.rate_above_pence ?? null;
      }
    }
  }

  const row = await storage.updateMileageTrip(id, req.user!.id, patch as never);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(row);
}

export async function archiveTrip(req: Request, res: Response) {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await storage.archiveMileageTrip(id, req.user!.id);
  return res.status(204).send();
}
