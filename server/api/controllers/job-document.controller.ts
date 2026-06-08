import type { Request, Response } from "express";
import { db } from "../config/db";
import { jobDocuments, jobs, job_applications } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import { ObjectStorageService } from "../utils/object-storage";
import { isLocalPath, saveLocally, deleteLocally, readLocally } from "../utils/local-storage-fallback";
import { randomUUID } from "crypto";

const ALLOWED_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];
const MAX_SIZE = 10 * 1024 * 1024; // 10MB

// ── Upload a document to a job ────────────────────────────────────────────
// Accepts base64-encoded file data in JSON. Uploads directly to GCS via
// objectStorageClient (no signed-URL sidecar required — works in production).
export async function uploadJobDocument(req: Request, res: Response) {
  try {
    const companyId = (req as any).companyId as number;
    const jobId = parseInt(req.params.jobId);
    const { fileData, filename, contentType, documentType = "other" } = req.body;

    if (isNaN(jobId)) return res.status(400).json({ error: "Invalid job ID" });

    if (!fileData || !filename || !contentType) {
      return res.status(400).json({ error: "fileData, filename, and contentType are required" });
    }

    if (!ALLOWED_TYPES.includes(contentType)) {
      return res.status(400).json({ error: "Only PDF, Word, and Excel files are allowed" });
    }

    const buffer = Buffer.from(fileData, "base64");

    if (buffer.length > MAX_SIZE) {
      return res.status(400).json({ error: "File too large. Max 10MB." });
    }

    // Verify job belongs to this employer/company
    const [job] = await db
      .select()
      .from(jobs)
      .where(and(eq(jobs.id, jobId), eq(jobs.recruiter_id, companyId)));

    if (!job) return res.status(403).json({ error: "Job not found or not yours" });

    const fileExtension = filename.split(".").pop() || "pdf";
    const fileKey = `job-docs/${jobId}/${randomUUID()}.${fileExtension}`;

    let storedKey = fileKey;
    try {
      const putUrl = await ObjectStorageService.getUploadUrl(fileKey, contentType);
      const uploadRes = await fetch(putUrl, {
        method: "PUT",
        headers: { "Content-Type": contentType },
        body: buffer,
      });
      if (!uploadRes.ok) {
        const errText = await uploadRes.text().catch(() => "");
        throw new Error(`Storage upload failed (${uploadRes.status}): ${errText.slice(0, 200)}`);
      }
      console.log(`✅ Job document uploaded to object storage: ${fileKey}`);
    } catch (uploadError: any) {
      console.warn(`⚠️  Object storage unavailable (${uploadError?.message}), falling back to local disk`);
      storedKey = await saveLocally(fileKey, buffer);
      console.log(`✅ Job document saved locally: ${storedKey}`);
    }

    const [doc] = await db
      .insert(jobDocuments)
      .values({
        jobId,
        uploadedByUserId: (req as any).user.id,
        fileName: filename,
        fileKey: storedKey,
        fileSize: buffer.length,
        fileType: contentType,
        documentType,
      })
      .returning();

    console.log(`✅ Job document uploaded: ${fileKey}`);
    return res.status(201).json(doc);
  } catch (err) {
    console.error("uploadJobDocument:", err);
    return res.status(500).json({ error: "Failed to upload document" });
  }
}

// ── Get documents for a job (with signed download URLs) ──────────────────
// Employer who owns the job OR a hired freelancer can access
export async function getJobDocuments(req: Request, res: Response) {
  try {
    const userId = (req as any).user.id;
    const companyId = (req as any).companyId as number | undefined;
    const jobId = parseInt(req.params.jobId);

    if (isNaN(jobId)) return res.status(400).json({ error: "Invalid job ID" });

    const [job] = await db.select().from(jobs).where(eq(jobs.id, jobId));
    if (!job) return res.status(404).json({ error: "Job not found" });

    const isEmployer = companyId !== undefined && companyId === job.recruiter_id;

    if (!isEmployer) {
      const [hired] = await db
        .select()
        .from(job_applications)
        .where(
          and(
            eq(job_applications.job_id, jobId),
            eq(job_applications.freelancer_id, userId),
            eq(job_applications.status, "hired")
          )
        );
      if (!hired) {
        return res.status(403).json({
          error: "Documents are only available to hired freelancers",
        });
      }
    }

    const docs = await db
      .select()
      .from(jobDocuments)
      .where(eq(jobDocuments.jobId, jobId));

    // Attach download URLs — use signed GCS URL or fall back to local-serve endpoint
    const docsWithUrls = await Promise.all(
      docs.map(async doc => {
        if (isLocalPath(doc.fileKey)) {
          return { ...doc, downloadUrl: `/api/job/${jobId}/documents/${doc.id}/download` };
        }
        try {
          const downloadUrl = await ObjectStorageService.getDownloadUrl(doc.fileKey);
          return { ...doc, downloadUrl };
        } catch {
          return { ...doc, downloadUrl: null };
        }
      })
    );

    return res.json(docsWithUrls);
  } catch (err) {
    console.error("getJobDocuments:", err);
    return res.status(500).json({ error: "Failed to fetch documents" });
  }
}

// ── Delete a document (employer only) ────────────────────────────────────
export async function deleteJobDocument(req: Request, res: Response) {
  try {
    const companyId = (req as any).companyId as number;
    const docId = parseInt(req.params.docId);

    if (isNaN(docId)) return res.status(400).json({ error: "Invalid document ID" });

    const result = await db
      .select({ doc: jobDocuments, recruiterId: jobs.recruiter_id })
      .from(jobDocuments)
      .innerJoin(jobs, eq(jobDocuments.jobId, jobs.id))
      .where(eq(jobDocuments.id, docId));

    if (!result.length) return res.status(404).json({ error: "Document not found" });

    const { doc, recruiterId } = result[0];

    if (recruiterId !== companyId) {
      return res.status(403).json({ error: "Not authorised" });
    }

    try {
      if (isLocalPath(doc.fileKey)) {
        await deleteLocally(doc.fileKey);
      } else {
        await ObjectStorageService.deleteObject(doc.fileKey);
      }
    } catch (deleteError) {
      console.error("Storage delete error:", deleteError);
    }

    await db.delete(jobDocuments).where(eq(jobDocuments.id, docId));
    return res.json({ success: true });
  } catch (err) {
    console.error("deleteJobDocument:", err);
    return res.status(500).json({ error: "Failed to delete document" });
  }
}

// ── Serve a locally-stored job document (fallback when sidecar is down) ──
export async function downloadJobDocumentLocal(req: Request, res: Response) {
  try {
    const docId = parseInt(req.params.docId);
    if (isNaN(docId)) return res.status(400).json({ error: "Invalid document ID" });

    const [doc] = await db.select().from(jobDocuments).where(eq(jobDocuments.id, docId));
    if (!doc) return res.status(404).json({ error: "Document not found" });

    if (!isLocalPath(doc.fileKey)) {
      return res.status(400).json({ error: "Document is not locally stored" });
    }

    const buffer = await readLocally(doc.fileKey);
    res.set({
      "Content-Type": doc.fileType,
      "Content-Disposition": `attachment; filename="${doc.fileName}"`,
      "Content-Length": buffer.length.toString(),
      "Cache-Control": "private, no-store",
    });
    res.end(buffer);
  } catch (err) {
    console.error("downloadJobDocumentLocal:", err);
    res.status(500).json({ error: "Failed to download document" });
  }
}

// ── Helper: fetch docs with signed URLs (for email sending) ───────────────
export async function getJobDocumentsWithUrls(jobId: number) {
  const docs = await db
    .select()
    .from(jobDocuments)
    .where(eq(jobDocuments.jobId, jobId));

  return Promise.all(
    docs.map(async doc => {
      try {
        const downloadUrl = await ObjectStorageService.getDownloadUrl(doc.fileKey);
        return { ...doc, downloadUrl };
      } catch {
        return { ...doc, downloadUrl: null };
      }
    })
  );
}
