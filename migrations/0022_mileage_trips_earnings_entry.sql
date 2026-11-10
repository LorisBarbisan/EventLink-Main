ALTER TABLE "mileage_trips"
  ADD COLUMN IF NOT EXISTS "earnings_entry_id" integer REFERENCES "earnings_entries"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "mileage_trips_earnings_entry_idx" ON "mileage_trips" ("earnings_entry_id");
