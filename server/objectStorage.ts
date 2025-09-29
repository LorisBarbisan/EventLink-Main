import { Storage, File } from "@google-cloud/storage";
import { Response } from "express";
import { randomUUID } from "crypto";

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// The object storage client is used to interact with the object storage service.
export const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
export class ObjectStorageService {
  constructor() {}

  // Gets the private object directory.
  getPrivateObjectDir(): string {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Downloads an object to the response.
  async downloadObject(file: File, res: Response, cacheTtlSec: number = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `private, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for a CV file.
  async getCVUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/cvs/${objectId}`;

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900, // 15 minutes
    });
  }

  // Gets the CV file from the object path.
  async getCVFile(objectPath: string): Promise<File> {
    // Handle both /cvs/ and /objects/uploads/ path formats
    if (!objectPath.startsWith("/cvs/") && !objectPath.startsWith("/objects/uploads/")) {
      throw new ObjectNotFoundError();
    }

    let privateDir = this.getPrivateObjectDir();
    if (!privateDir.endsWith("/")) {
      privateDir = `${privateDir}/`;
    }
    
    let cvPath;
    if (objectPath.startsWith("/objects/uploads/")) {
      // Handle legacy /objects/uploads/ format - use path as is
      cvPath = objectPath;
    } else {
      // Handle /cvs/ format
      cvPath = `${privateDir}${objectPath.substring(1)}`; // Remove leading slash
    }
    
    const { bucketName, objectName } = parseObjectPath(cvPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const cvFile = bucket.file(objectName);
    const [exists] = await cvFile.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    return cvFile;
  }

  // Static method: Get upload URL for a file (generic)
  static async getUploadUrl(objectKey: string, contentType: string): Promise<string> {
    const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!privateDir) {
      throw new Error("PRIVATE_OBJECT_DIR not set");
    }
    
    const fullPath = `${privateDir}/${objectKey}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900, // 15 minutes
    });
  }

  // Static method: Get download URL for a file
  static async getDownloadUrl(objectKey: string): Promise<string> {
    const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!privateDir) {
      throw new Error("PRIVATE_OBJECT_DIR not set");
    }
    
    const fullPath = objectKey.startsWith('/') ? `${privateDir}${objectKey}` : `${privateDir}/${objectKey}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    
    return signObjectURL({
      bucketName,
      objectName,
      method: "GET",
      ttlSec: 3600, // 1 hour
    });
  }

  // Static method: Delete a file
  static async deleteObject(objectKey: string): Promise<void> {
    const privateDir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!privateDir) {
      throw new Error("PRIVATE_OBJECT_DIR not set");
    }
    
    const fullPath = objectKey.startsWith('/') ? `${privateDir}${objectKey}` : `${privateDir}/${objectKey}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    await file.delete();
  }

  // Get upload URL for message attachments
  async getObjectEntityUploadURL(): Promise<string> {
    const privateObjectDir = this.getPrivateObjectDir();
    const objectId = randomUUID();
    const fullPath = `${privateObjectDir}/uploads/${objectId}`;
    const { bucketName, objectName } = parseObjectPath(fullPath);
    
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900, // 15 minutes
    });
  }

  // Normalize object path from upload URL
  normalizeObjectEntityPath(uploadURL: string): string {
    if (!uploadURL.startsWith("https://storage.googleapis.com/")) {
      return uploadURL;
    }
    
    const url = new URL(uploadURL);
    const rawObjectPath = url.pathname;
    let privateDir = this.getPrivateObjectDir();
    if (!privateDir.endsWith("/")) {
      privateDir = `${privateDir}/`;
    }
    
    if (!rawObjectPath.startsWith(privateDir)) {
      return rawObjectPath;
    }
    
    const objectId = rawObjectPath.slice(privateDir.length);
    return `/objects/${objectId}`;
  }

  // Set ACL policy for object (no-op for now, could implement later)
  async trySetObjectEntityAclPolicy(uploadURL: string, policy: { owner: string, visibility: string }): Promise<string> {
    // For now, just return the normalized path
    return this.normalizeObjectEntityPath(uploadURL);
  }

  // Get file object from path
  async getObjectEntityFile(objectPath: string): Promise<File> {
    let privateDir = this.getPrivateObjectDir();
    if (!privateDir.endsWith("/")) {
      privateDir = `${privateDir}/`;
    }
    
    // Handle paths starting with /objects/
    let fullPath;
    if (objectPath.startsWith("/objects/")) {
      fullPath = `${privateDir}${objectPath.substring(9)}`; // Remove "/objects/"
    } else {
      fullPath = `${privateDir}${objectPath.startsWith('/') ? objectPath.substring(1) : objectPath}`;
    }
    
    const { bucketName, objectName } = parseObjectPath(fullPath);
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectName);
    
    const [exists] = await file.exists();
    if (!exists) {
      throw new ObjectNotFoundError();
    }
    
    return file;
  }

  // Normalizes the CV path from upload URL to storage path
  normalizeCVPath(rawPath: string): string {
    if (!rawPath.startsWith("https://storage.googleapis.com/")) {
      return rawPath;
    }
  
    // Extract the path from the URL by removing query parameters and domain
    const url = new URL(rawPath);
    const rawObjectPath = url.pathname;
  
    let privateDir = this.getPrivateObjectDir();
    if (!privateDir.endsWith("/")) {
      privateDir = `${privateDir}/`;
    }
  
    if (!rawObjectPath.startsWith(privateDir)) {
      return rawObjectPath;
    }
  
    // Extract the CV ID from the path
    const cvId = rawObjectPath.slice(privateDir.length);
    return `/cvs/${cvId}`;
  }
}

function parseObjectPath(path: string): {
  bucketName: string;
  objectName: string;
} {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}: {
  bucketName: string;
  objectName: string;
  method: "GET" | "PUT" | "DELETE" | "HEAD";
  ttlSec: number;
}): Promise<string> {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}