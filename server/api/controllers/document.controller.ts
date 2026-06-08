import { DOCUMENT_TYPES, insertFreelancerDocumentSchema } from "@shared/schema";
import type { Request, Response } from "express";
import { storage } from "../../storage";
import { ObjectStorageService } from "../utils/object-storage";
import { isLocalPath, saveLocally, deleteLocally } from "../utils/local-storage-fallback";

const MAX_DOCUMENTS = 9;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];

export async function uploadDocument(req: Request, res: Response) {
  try {
    if (!(req as any).user || (req as any).user.role !== "freelancer") {
      return res.status(403).json({ error: "Only freelancers can upload documents" });
    }

    const { fileData, filename, fileSize, contentType, documentType, customTypeName } = req.body;

    if (!fileData || !filename || !contentType || !documentType) {
      return res.status(400).json({
        error: "File data, filename, content type, and document type are required",
      });
    }

    if (documentType === "Other" && (!customTypeName || !customTypeName.trim())) {
      return res.status(400).json({
        error: "Custom type name is required when document type is 'Other'",
      });
    }

    if (!DOCUMENT_TYPES.includes(documentType)) {
      return res.status(400).json({
        error: "Invalid document type",
        allowed: DOCUMENT_TYPES,
      });
    }

    if (!ALLOWED_FILE_TYPES.includes(contentType)) {
      return res.status(400).json({
        error: "File type not allowed. Accepted: PDF, JPG, PNG",
        allowed: ALLOWED_FILE_TYPES,
      });
    }

    const buffer = Buffer.from(fileData, "base64");
    const actualSize = buffer.length;
    
    if (actualSize > MAX_FILE_SIZE) {
      return res.status(400).json({
        error: "File size must be less than 10MB",
      });
    }

    const currentCount = await storage.getFreelancerDocumentCount((req as any).user.id);
    if (currentCount >= MAX_DOCUMENTS) {
      return res.status(400).json({
        error: `Maximum of ${MAX_DOCUMENTS} documents allowed. Delete an existing document to upload a new one.`,
      });
    }

    const { randomUUID } = await import("crypto");
    const fileExtension = filename.split(".").pop() || "pdf";
    const objectKey = `docs/${(req as any).user.id}/${randomUUID()}.${fileExtension}`;

    console.log(`📤 Uploading document: objectKey=${objectKey}, size=${actualSize} bytes`);

    let storedPath: string = objectKey;
    try {
      const signedPutUrl = await ObjectStorageService.getUploadUrl(objectKey, contentType);
      const uploadResponse = await fetch(signedPutUrl, {
        method: "PUT",
        body: buffer,
        headers: { "Content-Type": contentType },
      });

      if (!uploadResponse.ok) {
        const errText = await uploadResponse.text().catch(() => "");
        throw new Error(`Signed URL upload failed: ${uploadResponse.status} ${errText}`);
      }

      console.log(`✅ Document uploaded to object storage: ${objectKey}`);
    } catch (uploadError: any) {
      console.warn(`⚠️  Object storage unavailable (${uploadError?.message}), falling back to local disk`);
      storedPath = await saveLocally(objectKey, buffer);
      console.log(`✅ Document saved locally: ${storedPath}`);
    }

    const documentData = {
      freelancer_id: (req as any).user.id,
      document_type: documentType,
      custom_type_name: documentType === "Other" ? customTypeName?.trim() : null,
      file_url: storedPath,
      original_filename: filename,
      file_size: actualSize,
      file_type: contentType,
    };

    const validationResult = insertFreelancerDocumentSchema.safeParse(documentData);
    if (!validationResult.success) {
      // Cleanup uploaded file on validation failure
      try {
        if (isLocalPath(storedPath)) {
          deleteLocally(storedPath);
        } else {
          await ObjectStorageService.deleteObject(storedPath);
        }
      } catch (cleanupError) {
        console.error("Failed to cleanup uploaded file:", cleanupError);
      }
      return res.status(400).json({
        error: "Invalid document data",
        details: validationResult.error.issues,
      });
    }

    const document = await storage.createFreelancerDocument(validationResult.data);

    console.log(`✅ Document metadata saved for user ${(req as any).user.id}: ${filename}`);
    res.status(201).json({
      message: "Document uploaded successfully",
      document,
    });
  } catch (error) {
    console.error("❌ Upload document error:", error);
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to upload document" });
  }
}

export async function getDocuments(req: Request, res: Response) {
  try {
    const freelancerId = parseInt(req.params.freelancerId);

    if (Number.isNaN(freelancerId)) {
      return res.status(400).json({ error: "Invalid freelancer ID" });
    }

    const user = await storage.getUser(freelancerId);
    if (!user || user.role !== "freelancer") {
      return res.status(404).json({ error: "Freelancer not found" });
    }

    const documents = await storage.getFreelancerDocuments(freelancerId);
    res.json(documents);
  } catch (error) {
    console.error("Get documents error:", error);
    res.status(500).json({ error: "Failed to get documents" });
  }
}

export async function downloadDocument(req: Request, res: Response) {
  try {
    const documentId = parseInt(req.params.documentId);

    if (Number.isNaN(documentId)) {
      return res.status(400).json({ error: "Invalid document ID" });
    }

    if (!(req as any).user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    const document = await storage.getFreelancerDocumentById(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    const userRole = (req as any).user.role;
    const userId = (req as any).user.id;

    if (userRole === "freelancer" && document.freelancer_id !== userId) {
      return res.status(403).json({ error: "Not authorized to access this document" });
    }

    try {
      const downloadUrl = await ObjectStorageService.getDownloadUrl(document.file_url);
      console.log(`✅ Generated download URL for document: ${document.file_url}`);

      res.json({
        downloadUrl,
        fileName: document.original_filename,
      });
    } catch (objectError) {
      console.error(`❌ Failed to get download URL for ${document.file_url}:`, objectError);
      return res.status(404).json({ error: "Document file not found in storage" });
    }
  } catch (error) {
    console.error("Download document error:", error);
    res.status(500).json({ error: "Failed to download document" });
  }
}

export async function deleteDocument(req: Request, res: Response) {
  try {
    const documentId = parseInt(req.params.documentId);

    if (Number.isNaN(documentId)) {
      return res.status(400).json({ error: "Invalid document ID" });
    }

    if (!(req as any).user || (req as any).user.role !== "freelancer") {
      return res.status(403).json({ error: "Only freelancers can delete their documents" });
    }

    const document = await storage.getFreelancerDocumentById(documentId);
    if (!document) {
      return res.status(404).json({ error: "Document not found" });
    }

    if (document.freelancer_id !== (req as any).user.id) {
      return res.status(403).json({ error: "Not authorized to delete this document" });
    }

    try {
      if (isLocalPath(document.file_url)) {
        deleteLocally(document.file_url);
      } else {
        await ObjectStorageService.deleteObject(document.file_url);
      }
    } catch (deleteError) {
      console.error("Object storage delete error:", deleteError);
    }

    await storage.deleteFreelancerDocument(documentId, (req as any).user.id);

    res.json({ message: "Document deleted successfully" });
  } catch (error) {
    console.error("Delete document error:", error);
    res.status(500).json({ error: "Failed to delete document" });
  }
}

export async function getDocumentTypes(_req: Request, res: Response) {
  res.json(DOCUMENT_TYPES);
}
