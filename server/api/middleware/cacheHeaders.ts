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
    CacheHeaders.longCache(res);
  } else if (
    endpoint.includes("/api/notifications") ||
    endpoint.includes("/api/messages") ||
    endpoint.includes("/api/admin")
  ) {
    CacheHeaders.noCache(res);
  }
  // Location data - cache for 1 hour (static reference data)
  else if (endpoint.includes("/api/locations")) {
    CacheHeaders.longCache(res);
  }
  // File downloads - cache for 1 year
  else if (endpoint.includes("/download") || endpoint.includes("/cv/")) {
    CacheHeaders.staticAssets(res);
  }
  // Default for other endpoints
  else {
    CacheHeaders.mediumCache(res);
  }
}
