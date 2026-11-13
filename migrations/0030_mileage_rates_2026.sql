-- PR 1: Correct car mileage rate from 6 April 2026
-- HMRC raised the first-band rate from 45p to 55p; above-threshold (25p) unchanged.
-- Source: https://www.gov.uk/simpler-income-tax-simplified-expenses/vehicles

INSERT INTO mileage_rates (vehicle_type, rate_pence, threshold_miles, rate_above_pence, effective_from)
VALUES ('car', 55, 10000, 25, '2026-04-06')
ON CONFLICT DO NOTHING;

-- Recalculate all 2026/27 car trips logged on or after 2026-04-06 that still use the old 45p rate.
-- For each trip, the corrected amount applies 55p to whichever miles fall at or below the 10,000-mile
-- threshold for that freelancer/tax-year, and 25p to any miles above.
-- The threshold calculation uses the cumulative miles of earlier trips (by trip_date, then id)
-- within the same tax year (6 Apr 2026 – 5 Apr 2027) for car journeys.

DO $$
DECLARE
  r RECORD;
  ytd_before INTEGER;
  below_threshold INTEGER;
  above_threshold INTEGER;
  new_pence INTEGER;
BEGIN
  FOR r IN
    SELECT id, freelancer_id, trip_date, miles
    FROM mileage_trips
    WHERE vehicle_type = 'car'
      AND archived = false
      AND rate_pence = 45
      AND trip_date >= '2026-04-06'
      AND trip_date <= '2027-04-05'
    ORDER BY freelancer_id, trip_date, id
  LOOP
    -- Sum miles for earlier trips in same tax year for same freelancer (car only)
    SELECT COALESCE(SUM(miles), 0) INTO ytd_before
    FROM mileage_trips
    WHERE freelancer_id = r.freelancer_id
      AND vehicle_type = 'car'
      AND archived = false
      AND trip_date >= '2026-04-06'
      AND trip_date <= '2027-04-05'
      AND (trip_date < r.trip_date OR (trip_date = r.trip_date AND id < r.id));

    -- Split this trip across the 10,000-mile threshold
    below_threshold := GREATEST(0, LEAST(r.miles, 10000 - ytd_before));
    above_threshold := r.miles - below_threshold;
    new_pence := (below_threshold * 55) + (above_threshold * 25);

    UPDATE mileage_trips
    SET amount_pence    = new_pence,
        rate_pence      = 55,
        rate_above_pence = 25,
        updated_at      = NOW()
    WHERE id = r.id;
  END LOOP;
END $$;
