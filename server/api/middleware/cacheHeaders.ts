// Enhanced HTTP cache headers for different content types
import { Response } from "express";
import { CacheHeaders } from "../utils/cache-headers";

// Enhanced cache strategy based on content type
export function setCacheByEndpoint(res: Response, endpoint: string) {
  // Job listings - no cache (jobs can be created/updated frequently)
  if (endpoint.includes("/api/jobs") && !endpoint.includes("apply")) {
    CacheHeaders.noCache(res);
  }
  // User profiles - cache for 1 hour (profiles change infrequently)
  else if (endpoint.includes("/api/freelancer/") || endpoint.includes("/api/recruiter/")) {
    CacheHeaders.noCache(res);
  } else if (
    endpoint.includes("/api/notifications") ||
    endpoint.includes("/api/messages") ||
    endpoint.includes("/api/admin")
  ) {
    CacheHeaders.noCache(res);
  }
  // Location data - cache for 1 hour (static reference data)
  else if (endpoint.includes("/api/locations")) {
    CacheHeaders.noCache(res);
  }
  // CV API - never cache (status changes rapidly during parsing)
  else if (endpoint.includes("/api/cv/")) {
    CacheHeaders.noCache(res);
  }
  // File downloads (attachments, documents) - cache for 1 year
  else if (endpoint.includes("/download")) {
    CacheHeaders.staticAssets(res);
  }
  // Default for other endpoints
  else {
    CacheHeaders.noCache(res);
  }
}
