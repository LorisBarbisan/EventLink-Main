-- HMRC's approved mileage rate for a bicycle is 20p a mile. 0025 seeded 5p,
-- which is the passenger supplement from the same table, so cyclists were
-- claiming a quarter of what they're entitled to.
-- Source: https://www.gov.uk/simpler-income-tax-simplified-expenses/vehicles

UPDATE mileage_rates SET rate_pence = 20
WHERE vehicle_type = 'bicycle' AND rate_pence = 5;

-- Re-price bicycle trips logged at 5p (flat rate, no threshold).
UPDATE mileage_trips
SET amount_pence = miles * 20,
    rate_pence   = 20,
    updated_at   = NOW()
WHERE vehicle_type = 'bicycle' AND rate_pence = 5;

-- Make the ON CONFLICT DO NOTHING guards in 0025/0030 mean something: one
-- rate per vehicle per start date. Remove any duplicate a re-run left first.
DELETE FROM mileage_rates a
USING mileage_rates b
WHERE a.vehicle_type = b.vehicle_type
  AND a.effective_from = b.effective_from
  AND a.id > b.id;

DROP INDEX IF EXISTS mileage_rates_vehicle_from_idx;
CREATE UNIQUE INDEX IF NOT EXISTS mileage_rates_vehicle_from_key
  ON mileage_rates (vehicle_type, effective_from);
