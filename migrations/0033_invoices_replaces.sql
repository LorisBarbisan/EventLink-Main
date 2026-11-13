-- PR 6: Invoice correction support
-- replaces_invoice_id links a correction invoice back to the one it replaces.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS replaces_invoice_id INTEGER REFERENCES invoices(id) ON DELETE SET NULL;
