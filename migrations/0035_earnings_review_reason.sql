ALTER TABLE earnings_entries
  ADD COLUMN IF NOT EXISTS review_reason TEXT
    CHECK (review_reason IN ('unparsed_amount','ambiguous_amount','assumed_date','zero_amount'));
