---
name: Object storage uploads in production
description: How to upload files to GCS on Replit in production — what fails and what works.
---

## Rule
Never use `objectStorageClient.file.save()` or any GCS SDK upload method for server-side uploads. Always use the Replit sidecar to get a signed PUT URL, then upload via plain `fetch()`.

**Why:** The `objectStorageClient` (initialized with external-account / `IdentityPoolClient` credentials pointing at `127.0.0.1:1106`) fails in production with `Error: no allowed resources` when it tries to authenticate for any write operation — both resumable uploads (`resumable-upload.js`) and non-resumable ones. The sidecar token does not carry the GCS upload scope required by the SDK auth flow.

**How to apply:**
```typescript
// 1. Get a signed PUT URL from the sidecar (works in both dev and prod)
const putUrl = await ObjectStorageService.getUploadUrl(fileKey, contentType);

// 2. PUT the buffer directly — no GCS SDK auth, signature IS the auth
const uploadRes = await fetch(putUrl, {
  method: "PUT",
  headers: { "Content-Type": contentType },
  body: buffer,
});
if (!uploadRes.ok) throw new Error(`Storage upload failed: ${uploadRes.status}`);
```

**What DOES work:**
- `ObjectStorageService.getUploadUrl()` / `signObjectURL()` with `method: "PUT"` — sidecar can sign PUT URLs fine
- Plain `fetch()` PUT to the signed URL — no auth header needed, signature covers it
- `ObjectStorageService.getDownloadUrl()` + `signObjectURL(method: "GET")` — works in production
- `objectStorageClient.bucket().file().download()` / `file.exists()` — GCS SDK reads work fine
- CV uploads: browser receives signed PUT URL from server and PUTs directly — same sidecar path

**What FAILS in production:**
- `file.save(buffer, { contentType })` — resumable upload path, auth fails
- `file.save(buffer, { contentType, resumable: false })` — simple upload path, auth also fails
- Both produce: `Error: no allowed resources` in `IdentityPoolClient.refreshAccessTokenAsync`

**Affected controllers:** `job-document.controller.ts` uses fetch+signedURL. `document.controller.ts` (freelancer docs) still uses `file.save()` — likely also broken in production but untested.
