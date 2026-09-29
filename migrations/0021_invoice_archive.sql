ALTER TABLE invoices ADD COLUMN archived BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX invoices_archived_idx ON invoices (freelancer_id, archived) WHERE archived = TRUE;
