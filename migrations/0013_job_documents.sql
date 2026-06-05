CREATE TABLE IF NOT EXISTS "job_documents" (
  "id" serial PRIMARY KEY NOT NULL,
  "job_id" integer NOT NULL REFERENCES "jobs"("id") ON DELETE CASCADE,
  "uploaded_by_user_id" integer NOT NULL REFERENCES "users"("id"),
  "file_name" text NOT NULL,
  "file_key" text NOT NULL UNIQUE,
  "file_size" integer,
  "file_type" text,
  "document_type" text NOT NULL DEFAULT 'other',
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "job_documents_job_id_idx"
  ON "job_documents"("job_id");
CREATE INDEX IF NOT EXISTS "job_documents_uploaded_by_idx"
  ON "job_documents"("uploaded_by_user_id");
