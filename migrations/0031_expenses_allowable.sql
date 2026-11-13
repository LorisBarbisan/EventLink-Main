-- PR 3: Add allowable flag to expenses
-- Marks whether an expense is deductible for income tax purposes.
-- Defaults to true (all existing expenses remain allowable).
-- Set to false for personal expenditure, client entertainment, fines, etc.

ALTER TABLE expenses ADD COLUMN IF NOT EXISTS allowable boolean NOT NULL DEFAULT true;
