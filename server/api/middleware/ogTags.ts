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
  description: string;
  event_date?: string | null;
  end_date?: string | null;
}): string {
  const parts: string[] = [];
  parts.push(job.location);
  if (job.event_date) {
    let dateStr = formatDateBritish(job.event_date);
    if (job.end_date) dateStr += ` - ${formatDateBritish(job.end_date)}`;
    parts.push(dateStr);
  }
  parts.push(`£${job.rate.replace(/^£/, "")}`);
  const header = parts.join(" | ");
  if (job.description && job.description.trim()) {
    const maxDescLen = 200 - header.length - 3;
    const desc = job.description.trim();
    const truncated = desc.length > maxDescLen
      ? desc.substring(0, maxDescLen - 3) + "..."
      : desc;
    return `${header} | ${truncated}`;
  }
  return `${header} | View & apply on EventLink`;
}

function buildProfileDescription(profile: {
  title?: string | null;
  location?: string | null;
  bio?: string | null;
  skills?: string[] | null;
  superpower?: string | null;
  availability_status?: string | null;
}): string {
  const parts: string[] = [];
  if (profile.title) parts.push(profile.title);
  if (profile.location) parts.push(profile.location);
  if (profile.superpower) parts.push(profile.superpower);
  const header = parts.join(" | ");

  const availabilityLabel =
    profile.availability_status === "available"
      ? "Available for work"
      : profile.availability_status === "busy"
        ? "Currently busy"
        : null;

  const skillsSnippet =
    profile.skills && profile.skills.length > 0
      ? `Skills: ${profile.skills.slice(0, 4).join(", ")}`
      : null;

  const extra = [availabilityLabel, skillsSnippet].filter(Boolean).join(" · ");
  if (extra) return header ? `${header} | ${extra}` : extra;
  if (profile.bio) {
    const bio = profile.bio.trim();
    const truncated = bio.length > 160 ? bio.substring(0, 157) + "..." : bio;
    return header ? `${header} | ${truncated}` : truncated;
  }
  return header || "View this freelancer's profile on EventLink";
}

function buildOgHtml(opts: {
  url: string;
  title: string;
  description: string;
  imageUrl: string;
  linkText: string;
}): string {
  const { url, title, description, imageUrl, linkText } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <link rel="canonical" href="${escapeHtml(url)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="EventLink" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
</head>
<body>
  <h1>${title}</h1>
  <p>${description}</p>
  <a href="${escapeHtml(url)}">${linkText}</a>
</body>
</html>`;
}

function buildProfilePageHtml(opts: {
  url: string;
  imageUrl: string;
  fullName: string;
  title: string | null | undefined;
  location: string | null | undefined;
  bio: string | null | undefined;
  skills: string[] | null | undefined;
  superpower: string | null | undefined;
  availabilityStatus: string | null | undefined;
  experienceYears: number | null | undefined;
  description: string;
}): string {
  const { url, imageUrl, fullName, title, location, bio, skills, superpower, availabilityStatus, experienceYears, description } = opts;

  const availabilityText =
    availabilityStatus === "available"
      ? "Available for work"
      : availabilityStatus === "busy"
        ? "Currently busy"
        : availabilityStatus === "unavailable"
          ? "Not currently available"
          : null;

  const skillsList = skills && skills.length > 0 ? skills.join(", ") : null;
  const expText = experienceYears ? `${experienceYears} year${experienceYears === 1 ? "" : "s"} of experience` : null;

  const metaTitle = escapeHtml(`${fullName}${title ? ` — ${title}` : ""} | EventLink`);
  const metaDesc = escapeHtml(description);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${metaTitle}</title>
  <meta name="description" content="${metaDesc}" />
  <link rel="canonical" href="${escapeHtml(url)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="profile" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:title" content="${metaTitle}" />
  <meta property="og:description" content="${metaDesc}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="EventLink" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${metaTitle}" />
  <meta name="twitter:description" content="${metaDesc}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
</head>
<body>
  <header>
    <nav><a href="https://eventlink.one">EventLink — Event Industry Professional Network</a></nav>
  </header>
  <main>
    <article>
      <h1>${escapeHtml(fullName)}</h1>
      ${title ? `<h2>${escapeHtml(title)}</h2>` : ""}
      ${location ? `<p><strong>Location:</strong> ${escapeHtml(location)}</p>` : ""}
      ${expText ? `<p><strong>Experience:</strong> ${escapeHtml(expText)}</p>` : ""}
      ${availabilityText ? `<p><strong>Status:</strong> ${escapeHtml(availabilityText)}</p>` : ""}
      ${superpower ? `<p><strong>Superpower:</strong> ${escapeHtml(superpower)}</p>` : ""}
      ${bio ? `<section><h3>About</h3><p>${escapeHtml(bio)}</p></section>` : ""}
      ${skillsList ? `<section><h3>Skills</h3><p>${escapeHtml(skillsList)}</p></section>` : ""}
      <p><a href="${escapeHtml(url)}">View full profile and connect on EventLink</a></p>
    </article>
  </main>
  <footer>
    <p>EventLink connects event professionals with opportunities across the UK events industry.</p>
    <a href="https://eventlink.one">Find event professionals on EventLink</a>
  </footer>
</body>
</html>`;
}

export function ogTagMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!isCrawler(req.headers["user-agent"])) {
    return next();
  }

  const jobIdMatch = req.path.match(/^\/jobs\/(\d+)$/);
  const profileIdMatch = req.path.match(/^\/profile\/(\d+)$/);

  if (jobIdMatch) {
    const jobId = parseInt(jobIdMatch[1]);
    if (isNaN(jobId)) return next();

    storage
      .getJobById(jobId)
      .then(job => {
        if (!job || (job.status !== "active" && job.status !== "private")) {
          return res.status(200).set({ "Content-Type": "text/html" }).end(buildFallbackHtml());
        }
        const baseUrl = getBaseUrl(req);
        const jobUrl = `${baseUrl}/jobs/${job.id}`;
        const ogImageUrl = `${baseUrl}/og-image.png`;
        const html = buildOgHtml({
          url: jobUrl,
          title: escapeHtml(`${job.title} | EventLink`),
          description: escapeHtml(buildJobDescription(job)),
          imageUrl: ogImageUrl,
          linkText: "View &amp; apply on EventLink",
        });
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      })
      .catch(error => {
        console.error("OG tag middleware error (job):", error);
        next();
      });
    return;
  }

  if (profileIdMatch) {
    const userId = parseInt(profileIdMatch[1]);
    if (isNaN(userId)) return next();

    storage
      .getFreelancerProfile(userId)
      .then(profile => {
        if (!profile) {
          return res.status(200).set({ "Content-Type": "text/html" }).end(buildFallbackHtml());
        }
        const baseUrl = getBaseUrl(req);
        const profileUrl = `${baseUrl}/profile/${userId}`;
        const hasPhoto = !!(profile.profile_photo_url && profile.profile_photo_url.trim());
        const ogImageUrl = hasPhoto
          ? `${baseUrl}/api/profile-photo/${userId}`
          : `${baseUrl}/og-image.png`;
        const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Freelancer";
        const html = buildProfilePageHtml({
          url: profileUrl,
          imageUrl: ogImageUrl,
          fullName,
          title: profile.title,
          location: profile.location,
          bio: profile.bio,
          skills: profile.skills,
          superpower: profile.superpower,
          availabilityStatus: profile.availability_status,
          experienceYears: profile.experience_years,
          description: buildProfileDescription(profile),
        });
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      })
      .catch(error => {
        console.error("OG tag middleware error (profile):", error);
        next();
      });
    return;
  }

  next();
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
