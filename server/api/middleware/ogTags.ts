import type { Request, Response, NextFunction } from "express";
import { storage } from "../../storage";

const CRAWLER_USER_AGENTS = [
  "facebookexternalhit",
  "Facebot",
  "LinkedInBot",
  "Twitterbot",
  "WhatsApp",
  "Slackbot",
  "TelegramBot",
  "Discordbot",
  "Googlebot",
  "bingbot",
  "Pinterestbot",
  "vkShare",
  "Embedly",
];

function isCrawler(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return CRAWLER_USER_AGENTS.some(bot =>
    userAgent.toLowerCase().includes(bot.toLowerCase())
  );
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatDateBritish(dateStr: string): string {
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function buildJobDescription(job: {
  location: string;
  type: string;
  rate: string;
  event_date?: string | null;
  end_date?: string | null;
}): string {
  const parts: string[] = [];
  parts.push(job.location);
  parts.push(`£${job.rate.replace(/^£/, "")}`);
  if (job.event_date) {
    let dateStr = formatDateBritish(job.event_date);
    if (job.end_date) dateStr += ` - ${formatDateBritish(job.end_date)}`;
    parts.push(dateStr);
  }
  parts.push(job.type);
  parts.push("View & apply on EventLink");
  return parts.join(" | ");
}

export function ogTagMiddleware(req: Request, res: Response, next: NextFunction) {
  const jobIdMatch = req.path.match(/^\/jobs\/(\d+)$/);
  if (!jobIdMatch) {
    return next();
  }

  if (!isCrawler(req.headers["user-agent"])) {
    return next();
  }

  const jobId = parseInt(jobIdMatch[1]);
  if (isNaN(jobId)) {
    return next();
  }

  storage
    .getJobById(jobId)
    .then(job => {
      if (!job || (job.status !== "active" && job.status !== "private")) {
        const fallbackHtml = buildFallbackHtml();
        return res.status(200).set({ "Content-Type": "text/html" }).end(fallbackHtml);
      }

      const baseUrl = getBaseUrl(req);
      const jobUrl = `${baseUrl}/jobs/${job.id}`;
      const ogImageUrl = `${baseUrl}/og-image.png`;
      const title = escapeHtml(`${job.title} | EventLink`);
      const description = escapeHtml(buildJobDescription(job));

      const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(jobUrl)}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="EventLink" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}" />
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  <a href="${escapeHtml(jobUrl)}">View & apply on EventLink</a>
</body>
</html>`;

      res.status(200).set({ "Content-Type": "text/html" }).end(html);
    })
    .catch(error => {
      console.error("OG tag middleware error:", error);
      next();
    });
}

function buildFallbackHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>EventLink - Event Industry Professional Network</title>
  <meta property="og:type" content="website" />
  <meta property="og:title" content="EventLink - Event Industry Professional Network" />
  <meta property="og:description" content="Connect with top event professionals. Find crew, post jobs, and grow your network in the UK events industry." />
  <meta property="og:image" content="https://eventlink.one/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
</head>
<body>
  <p>This job is no longer available on EventLink.</p>
</body>
</html>`;
}

function getBaseUrl(req: Request): string {
  const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host || "eventlink.one";
  return `${protocol}://${host}`;
}
