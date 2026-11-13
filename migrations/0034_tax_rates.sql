-- PR 8: Effective-dated tax rate bands table.
-- Stores the full TaxBands payload (minus taxYear, which is the PK label).
-- Seed rows for 2024/25 → 2026/27 so the app works without a code deploy.

CREATE TABLE IF NOT EXISTS tax_rates (
  tax_year          TEXT      PRIMARY KEY,          -- e.g. "2024/25"
  effective_from    DATE      NOT NULL,              -- 6 April of start year
  bands             JSONB     NOT NULL,              -- TaxBands fields (no taxYear key)
  govuk_etag        TEXT,                            -- Last-Modified / ETag from gov.uk
  govuk_checked_at  TIMESTAMPTZ,                     -- when we last polled gov.uk
  stale_flag        BOOLEAN   NOT NULL DEFAULT FALSE, -- set when gov.uk page updated
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed current bands (matches BANDS_2024_25 / 2025_26 / 2026_27 in tax-estimate.ts)
INSERT INTO tax_rates (tax_year, effective_from, bands) VALUES
  ('2024/25', '2024-04-06', '{
    "personalAllowancePence": 1257000,
    "taperThresholdPence": 10000000,
    "basicRatePence": 5027000,
    "higherRatePence": 12514000,
    "basicRatePct": 20,
    "higherRatePct": 40,
    "additionalRatePct": 45,
    "niLowerPence": 1257000,
    "niUpperPence": 5027000,
    "niLowerRatePct": 6,
    "niUpperRatePct": 2
  }'),
  ('2025/26', '2025-04-06', '{
    "personalAllowancePence": 1257000,
    "taperThresholdPence": 10000000,
    "basicRatePence": 5027000,
    "higherRatePence": 12514000,
    "basicRatePct": 20,
    "higherRatePct": 40,
    "additionalRatePct": 45,
    "niLowerPence": 1257000,
    "niUpperPence": 5027000,
    "niLowerRatePct": 6,
    "niUpperRatePct": 2
  }'),
  ('2026/27', '2026-04-06', '{
    "personalAllowancePence": 1257000,
    "taperThresholdPence": 10000000,
    "basicRatePence": 5027000,
    "higherRatePence": 12514000,
    "basicRatePct": 20,
    "higherRatePct": 40,
    "additionalRatePct": 45,
    "niLowerPence": 1257000,
    "niUpperPence": 5027000,
    "niLowerRatePct": 6,
    "niUpperRatePct": 2
  }')
ON CONFLICT (tax_year) DO NOTHING;
