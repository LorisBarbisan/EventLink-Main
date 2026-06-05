---
name: Object storage signed URLs fail in production
description: signObjectURL (sidecar /object-storage/signed-object-url) returns 401 in production deployments; use objectStorageClient directly instead.
---

## Rule
Never use `signObjectURL` / `ObjectStorageService.getUploadUrl()` for server-side uploads in production. Always use `objectStorageClient.bucket(bucket).file(name).save(buffer)` (or `.download()`) directly.

**Why:** The Replit sidecar endpoint `http://127.0.0.1:1106/object-storage/signed-object-url` requires auth headers that are not passed by the current `signObjectURL` helper. It returns HTTP 401 in production deployments, causing any upload that relies on it to fail with "Failed to sign object URL, errorcode: 401".

The sidecar's `/credential` endpoint (used by `objectStorageClient` itself for ADC) works fine in production — only the signed-URL endpoint is broken.

**How to apply:**
- For server-side file writes: use `ObjectStorageService.uploadBuffer(fileKey, contentType, buffer)` — added as a static method using `file.save()`.
- For server-side file reads: use `ObjectStorageService.downloadObjectBuffer(key)` — also uses GCS client directly.
- `getDownloadUrl` and `getCVUploadURL` also call `signObjectURL` — these may also fail in production if used for server-side operations. Browser-side downloads may work (signed URL returned to browser, browser fetches from GCS directly) but this hasn't been verified.
