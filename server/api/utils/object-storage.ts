import {
  S3Client,
  DeleteObjectCommand,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Response } from "express";
import { randomUUID } from "crypto";
import { Readable } from "stream";

function getR2Client(): S3Client {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY must be set");
  }

  const endpoint = `https://${accountId}.r2.cloudflarestorage.com`;

  return new S3Client({
    region: "auto",
    endpoint,
    credentials: { accessKeyId, secretAccessKey },
    forcePathStyle: true,
  });
}

function getBucket(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) throw new Error("R2_BUCKET_NAME must be set");
  return bucket;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

export class ObjectStorageService {
  constructor() {}

  // Gets the private object directory (kept for compatibility, returns bucket name).
  getPrivateObjectDir(): string {
    return getBucket();
  }

  // Downloads an object and streams it to the response.
  async downloadObject(objectKey: string, res: Response, cacheTtlSec: number = 3600) {
    try {
      const client = getR2Client();
      const command = new GetObjectCommand({ Bucket: getBucket(), Key: objectKey });
      const { Body, ContentType, ContentLength } = await client.send(command);

      res.set({
        "Content-Type": ContentType || "application/octet-stream",
        ...(ContentLength ? { "Content-Length": String(ContentLength) } : {}),
        "Cache-Control": `private, max-age=${cacheTtlSec}`,
      });

      (Body as Readable).pipe(res);
    } catch (error: any) {
      if (error?.name === "NoSuchKey") throw new ObjectNotFoundError();
      if (!res.headersSent) res.status(500).json({ error: "Error streaming file" });
    }
  }

  // Gets a signed upload URL for a CV file.
  async getCVUploadURL(): Promise<string> {
    const objectKey = `cvs/${randomUUID()}`;
    return ObjectStorageService.getUploadUrl(objectKey, "application/pdf");
  }

  // Gets the CV object key from a stored path (identity, kept for compatibility).
  async getCVFile(objectPath: string): Promise<string> {
    const key = normalizeKey(objectPath);
    const client = getR2Client();
    // Verify existence
    try {
      await client.send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
    } catch (e: any) {
      if (e?.name === "NoSuchKey") throw new ObjectNotFoundError();
      throw e;
    }
    return key;
  }

  // Static method: Get a signed upload URL for a file.
  static async getUploadUrl(objectKey: string, contentType: string): Promise<string> {
    const client = getR2Client();
    const command = new PutObjectCommand({
      Bucket: getBucket(),
      Key: objectKey,
      ContentType: contentType,
    });
    return getSignedUrl(client, command, { expiresIn: 900 });
  }

  // Static method: Get a signed download URL for a file.
  static async getDownloadUrl(objectKey: string): Promise<string> {
    const client = getR2Client();
    const key = normalizeKey(objectKey);
    const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
    return getSignedUrl(client, command, { expiresIn: 3600 });
  }

  // Static method: Download object bytes server-side.
  static async downloadObjectBuffer(objectKey: string): Promise<Buffer> {
    const client = getR2Client();
    const key = normalizeKey(objectKey);
    const { Body } = await client.send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
    const chunks: Uint8Array[] = [];
    for await (const chunk of Body as Readable) {
      chunks.push(chunk);
    }
    return Buffer.concat(chunks);
  }

  // Static method: Upload a buffer directly.
  static async uploadBuffer(objectKey: string, contentType: string, buffer: Buffer): Promise<void> {
    const client = getR2Client();
    await client.send(
      new PutObjectCommand({
        Bucket: getBucket(),
        Key: objectKey,
        Body: buffer,
        ContentType: contentType,
      })
    );
  }

  // Static method: Delete a file.
  static async deleteObject(objectKey: string): Promise<void> {
    const client = getR2Client();
    const key = normalizeKey(objectKey);
    await client.send(new DeleteObjectCommand({ Bucket: getBucket(), Key: key }));
  }

  // Get a signed upload URL for message attachments.
  async getObjectEntityUploadURL(): Promise<string> {
    const objectKey = `uploads/${randomUUID()}`;
    return ObjectStorageService.getUploadUrl(objectKey, "application/octet-stream");
  }

  // Normalize object path from upload URL to storage key.
  normalizeObjectEntityPath(uploadURL: string): string {
    if (!uploadURL.startsWith("https://")) return uploadURL;
    try {
      const url = new URL(uploadURL);
      // Strip leading slash and query params — path is /<bucket>/<key>
      const parts = url.pathname.replace(/^\//, "").split("/");
      parts.shift(); // remove bucket name segment
      return parts.join("/");
    } catch {
      return uploadURL;
    }
  }

  async trySetObjectEntityAclPolicy(
    uploadURL: string,
    _policy: { owner: string; visibility: string }
  ): Promise<string> {
    return this.normalizeObjectEntityPath(uploadURL);
  }

  // Get and verify an object entity exists, returning its key.
  async getObjectEntityFile(objectPath: string): Promise<string> {
    const key = normalizeKey(objectPath);
    const client = getR2Client();
    try {
      await client.send(new GetObjectCommand({ Bucket: getBucket(), Key: key }));
    } catch (e: any) {
      if (e?.name === "NoSuchKey") throw new ObjectNotFoundError();
      throw e;
    }
    return key;
  }

  // Normalize CV path from upload URL to storage key.
  normalizeCVPath(rawPath: string): string {
    if (!rawPath.startsWith("https://")) return rawPath;
    return this.normalizeObjectEntityPath(rawPath);
  }
}

// Strip leading slashes and legacy path prefixes to get a clean R2 key.
function normalizeKey(objectPath: string): string {
  return objectPath.replace(/^\/+/, "");
}
