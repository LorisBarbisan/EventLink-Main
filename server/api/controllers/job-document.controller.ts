import type { Request, Response } from "express";
import { db } from "../config/db";
import { jobDocuments, jobs, job_applications } from "../../../shared/schema";
import { eq, and } from "drizzle-orm";
import { ObjectStorageService, objectStorageClient } from "../utils/object-storage";
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

    // Upload using the same pattern as compliance document uploads (document.controller.ts)
    const privateDir = process.env.PRIVATE_OBJECT_DIR;
    if (!privateDir) throw new Error("PRIVATE_OBJECT_DIR not set");

    const fullPath = `${privateDir}/${fileKey}`;
    const pathParts = fullPath.startsWith("/") ? fullPath.split("/") : `/${fullPath}`.split("/");
    const bucketName = pathParts[1];
    const objectName = pathParts.slice(2).join("/");

    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);

    try {
      await file.save(buffer, { contentType, metadata: { contentType } });
      console.log(`✅ Job document uploaded to storage: ${fileKey}`);
    } catch (uploadError) {
      console.error("❌ Job document storage upload error:", uploadError);
      throw new Error("Failed to upload document to storage");
    }

    const [doc] = await db
      .insert(jobDocuments)
      .values({
        jobId,
        uploadedByUserId: (req as any).user.id,
        fileName: filename,
        fileKey,
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

    // Attach fresh signed download URLs to each document
    const docsWithUrls = await Promise.all(
      docs.map(async doc => {
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
      await ObjectStorageService.deleteObject(doc.fileKey);
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
