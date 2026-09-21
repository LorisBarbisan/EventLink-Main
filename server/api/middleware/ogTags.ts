import type { NextFunction, Request, Response } from "express";
import { storage } from "../../storage";
import { faqData, buildFaqSchema } from "@shared/faqData";
import {
  getCrewLandingPage,
  getRelatedCrewPages,
  type CrewLandingPage,
} from "@shared/crewLandingPages";

const CRAWLER_USER_AGENTS = [
  // Social / link unfurlers
  "facebookexternalhit",
  "Facebot",
  "meta-externalagent",
  "LinkedInBot",
  "Twitterbot",
  "WhatsApp",
  "Slackbot",
  "TelegramBot",
  "Discordbot",
  "Pinterestbot",
  "vkShare",
  "Embedly",
  // Search engines
  "Googlebot",
  "bingbot",
  "YandexBot",
  "DuckDuckBot",
  "Baiduspider",
  "Applebot",
  "PetalBot",
  // AI crawlers — these generally don't run JavaScript, so they need the
  // server-rendered version to see any content at all.
  "PerplexityBot",
  "Perplexity-User",
  "GPTBot",
  "ChatGPT-User",
  "OAI-SearchBot",
  "ClaudeBot",
  "Claude-Web",
  "anthropic-ai",
  "Google-Extended",
  "Amazonbot",
  "Bytespider",
  "CCBot",
  "cohere-ai",
  // SEO audit crawlers
  "AhrefsBot",
  "SemrushBot",
  "DataForSeoBot",
];

function isCrawler(userAgent: string | undefined): boolean {
  if (!userAgent) return false;
  return CRAWLER_USER_AGENTS.some((bot) => userAgent.toLowerCase().includes(bot.toLowerCase()));
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
    const truncated = desc.length > maxDescLen ? desc.substring(0, maxDescLen - 3) + "..." : desc;
    return `${header} | ${truncated}`;
  }
  return `${header} | View & apply on EventLink`;
}

function buildProfileDescription(profile: {
  first_name?: string | null;
  last_name?: string | null;
  title?: string | null;
  location?: string | null;
  bio?: string | null;
  skills?: string[] | null;
  superpower?: string | null;
  availability_status?: string | null;
  experience_years?: number | null;
}): string {
  const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
  const role = profile.title || profile.superpower;

  // Preferred SEO form, e.g.
  // "Paul Baird is a Video Engineer in Manchester with 30 years' experience, available on EventLink."
  if (fullName && role) {
    let sentence = `${fullName} is a ${role}`;
    if (profile.location) sentence += ` in ${profile.location}`;
    // Guard against the seed record's sentinel 999 years (noindexed anyway).
    if (
      profile.experience_years &&
      profile.experience_years > 0 &&
      profile.experience_years < 100
    ) {
      sentence += ` with ${profile.experience_years} year${
        profile.experience_years === 1 ? "" : "s"
      }' experience`;
    }
    sentence +=
      profile.availability_status === "available" ? ", available on EventLink." : " on EventLink.";
    return sentence;
  }

  // Fallback for profiles missing both title and superpower.
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

// Server-rendered HTML for static marketing routes, so crawlers that don't run
// JavaScript (Bing, most AI crawlers) get per-page title/description/H1 instead
// of the SPA shell's homepage metadata. H1s mirror the live page headings.
function buildStaticPageHtml(opts: {
  url: string;
  title: string;
  description: string;
  h1: string;
  bodyHtml: string;
  imageUrl: string;
}): string {
  const { url, title, description, h1, bodyHtml, imageUrl } = opts;
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(url)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(imageUrl)}" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="EventLink" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(imageUrl)}" />
</head>
<body>
  <h1>${escapeHtml(h1)}</h1>
  ${bodyHtml}
</body>
</html>`;
}

// Server-rendered "freelance crew" landing page for crawlers. Emits the H1,
// intro copy, a list of matching freelancer profiles as real internal links, and
// cross-links to sibling landing pages — so non-JS engines see substantive,
// interlinked content rather than the SPA shell.
function buildCrewLandingHtml(opts: {
  baseUrl: string;
  page: CrewLandingPage;
  freelancers: Array<{
    user_id: number;
    first_name?: string | null;
    last_name?: string | null;
    title?: string | null;
    location?: string | null;
    slug?: string | null;
  }>;
}): string {
  const { baseUrl, page, freelancers } = opts;
  const url = `${baseUrl}${page.path}`;

  const profileItems = freelancers
    .map((f) => {
      const name = `${f.first_name || ""} ${f.last_name || ""}`.trim() || "Freelancer";
      const profileUrl = f.slug
        ? `${baseUrl}/freelancers/${f.slug}`
        : `${baseUrl}/profile/${f.user_id}`;
      const label = f.title ? `${name} — ${f.title}` : name;
      return `      <li><a href="${escapeHtml(profileUrl)}">${escapeHtml(label)}</a>${
        f.location ? ` — ${escapeHtml(f.location)}` : ""
      }</li>`;
    })
    .join("\n");

  const relatedItems = getRelatedCrewPages(page)
    .map(
      (r) =>
        `      <li><a href="${escapeHtml(`${baseUrl}${r.path}`)}">Freelance ${escapeHtml(
          r.role.heading
        )} in ${escapeHtml(r.city.name)}</a></li>`
    )
    .join("\n");

  const profilesSection = freelancers.length
    ? `    <h2>${escapeHtml(page.role.heading)} available in ${escapeHtml(page.city.name)}</h2>
    <ul>
${profileItems}
    </ul>`
    : `    <p>New ${escapeHtml(page.role.descLabel)} join EventLink every week — <a href="${escapeHtml(
        `${baseUrl}/freelancers`
      )}">browse all crew</a>.</p>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(page.title)}</title>
  <meta name="description" content="${escapeHtml(page.metaDescription)}" />
  <link rel="canonical" href="${escapeHtml(url)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:title" content="${escapeHtml(page.title)}" />
  <meta property="og:description" content="${escapeHtml(page.metaDescription)}" />
  <meta property="og:image" content="${escapeHtml(baseUrl)}/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="EventLink" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(page.title)}" />
  <meta name="twitter:description" content="${escapeHtml(page.metaDescription)}" />
  <meta name="twitter:image" content="${escapeHtml(baseUrl)}/og-image.png" />
</head>
<body>
  <main>
    <h1>${escapeHtml(page.h1)}</h1>
    <p>${escapeHtml(page.intro)}</p>
    <p>${escapeHtml(page.howItWorks)}</p>
    <p><a href="${escapeHtml(`${baseUrl}/freelancers`)}">${escapeHtml(page.browseCtaLabel)}</a></p>
${profilesSection}
    <h2>Related searches</h2>
    <ul>
${relatedItems}
    </ul>
  </main>
</body>
</html>`;
}

// Server-rendered Help Centre for crawlers. Emits the FAQPage JSON-LD schema AND
// the visible Q&A as real HTML, so non-JS engines (Bing, Perplexity, etc.) get the
// structured data and answers that the React page only injects client-side.
function buildFaqPageHtml(baseUrl: string): string {
  const url = `${baseUrl}/faq`;
  const title = "Help Centre - Frequently Asked Questions | EventLink";
  const description =
    "Find answers to frequently asked questions about EventLink - the premier platform connecting event professionals with opportunities across the events industry.";
  const schemaJson = JSON.stringify(buildFaqSchema());

  const sections = faqData
    .map((category) => {
      const items = category.questions
        .map((q) => {
          const answer = q.answerLink
            ? q.answer.replace(
                q.answerLink.text,
                `<a href="${escapeHtml(q.answerLink.url)}">${escapeHtml(q.answerLink.text)}</a>`
              )
            : escapeHtml(q.answer);
          return `      <div>
        <h3>${escapeHtml(q.question)}</h3>
        <p>${answer}</p>
      </div>`;
        })
        .join("\n");
      return `    <section>
      <h2>${escapeHtml(category.category)}</h2>
${items}
    </section>`;
    })
    .join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <link rel="canonical" href="${escapeHtml(url)}" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:url" content="${escapeHtml(url)}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:image" content="${escapeHtml(baseUrl)}/og-image.png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:site_name" content="EventLink" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${escapeHtml(baseUrl)}/og-image.png" />

  <script type="application/ld+json">${schemaJson}</script>
</head>
<body>
  <main>
    <h1>Help Centre</h1>
    <p>Find answers to frequently asked questions about EventLink.</p>
${sections}
  </main>
</body>
</html>`;
}

const STATIC_PAGES: Record<
  string,
  { title: string; description: string; h1: string; bodyHtml: string }
> = {
  "/": {
    title: "EventLink | Freelance Events Crew Network",
    description:
      "EventLink is a freelance events crew network — employers find vetted crew fast; freelancers find event jobs and build their reputation.",
    h1: "EventLink: the freelance events crew network",
    bodyHtml: `<p>EventLink is where freelance event professionals build trusted profiles, showcase their experience, and connect with the companies that power live events.</p>
  <ul>
    <li><a href="/jobs">Event crew jobs</a></li>
    <li><a href="/freelancers">Find freelance event crew</a></li>
    <li><a href="/how-it-works">How EventLink works</a></li>
  </ul>`,
  },
  "/how-it-works": {
    title: "How EventLink Works | Freelance Events Crew Network",
    description: "See how EventLink connects freelance event crew with employers, step by step.",
    h1: "How EventLink Works",
    bodyHtml: `<p>EventLink connects event professionals with opportunities across the events industry. Freelancers build a profile and find work; employers post jobs and hire skilled crew.</p>`,
  },
  "/jobs": {
    title: "Event Crew Jobs | EventLink",
    description: "Browse event industry jobs on EventLink, the freelance events crew network.",
    h1: "Event Crew Jobs",
    bodyHtml: `<p>Discover event industry jobs on EventLink and connect with top companies hiring freelance event crew across the UK.</p>`,
  },
  "/freelancers": {
    title: "Find Freelance Event Crew | EventLink",
    description: "Search vetted freelance event crew on EventLink.",
    h1: "Find Freelance Event Crew",
    bodyHtml: `<p>Search and hire vetted freelance event crew on EventLink. Browse profiles and connect with skilled technical professionals for your events.</p>`,
  },
};

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
  noindex: boolean;
}): string {
  const {
    url,
    imageUrl,
    fullName,
    title,
    location,
    bio,
    skills,
    superpower,
    availabilityStatus,
    experienceYears,
    description,
    noindex,
  } = opts;

  const availabilityText =
    availabilityStatus === "available"
      ? "Available for work"
      : availabilityStatus === "busy"
        ? "Currently busy"
        : availabilityStatus === "unavailable"
          ? "Not currently available"
          : null;

  const skillsList = skills && skills.length > 0 ? skills.join(", ") : null;
  const expText = experienceYears
    ? `${experienceYears} year${experienceYears === 1 ? "" : "s"} of experience`
    : null;

  const metaTitle = escapeHtml(`${fullName}${title ? ` — ${title}` : ""} | EventLink`);
  const metaDesc = escapeHtml(description);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  ${noindex ? '<meta name="robots" content="noindex" />' : ""}
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
  const jobSlugMatch = req.path.match(/^\/jobs\/([a-z][a-z0-9-]+)$/);
  const profileIdMatch = req.path.match(/^\/profile\/(\d+)$/);
  const freelancerSlugMatch = req.path.match(/^\/freelancers\/([a-z][a-z0-9-]+)$/);
  const employerSlugMatch = req.path.match(/^\/employers\/([a-z][a-z0-9-]+)$/);

  const handleJob = (jobFn: () => Promise<any>) => {
    jobFn()
      .then((job) => {
        if (!job || (job.status !== "active" && job.status !== "private")) {
          return res.status(200).set({ "Content-Type": "text/html" }).end(buildFallbackHtml());
        }
        const baseUrl = getBaseUrl(req);
        const jobUrl = job.slug ? `${baseUrl}/jobs/${job.slug}` : `${baseUrl}/jobs/${job.id}`;
        const html = buildOgHtml({
          url: jobUrl,
          title: escapeHtml(`${job.title} | EventLink`),
          description: escapeHtml(buildJobDescription(job)),
          imageUrl: `${baseUrl}/og-image.png`,
          linkText: "View &amp; apply on EventLink",
        });
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      })
      .catch((err) => {
        console.error("OG job error:", err);
        next();
      });
  };

  const handleProfile = (profileFn: () => Promise<any>, userId?: number) => {
    profileFn()
      .then(async (profile) => {
        // Non-existent profile → real HTTP 404 (not a 200 "not found" shell).
        if (!profile) {
          return res.status(404).set({ "Content-Type": "text/html" }).end(buildNotFoundHtml());
        }
        const uid = userId ?? profile.user_id;
        const baseUrl = getBaseUrl(req);
        const profileUrl = profile.slug
          ? `${baseUrl}/freelancers/${profile.slug}`
          : `${baseUrl}/profile/${uid}`;
        const hasPhoto = !!(profile.profile_photo_url && profile.profile_photo_url.trim());
        const ogImageUrl = hasPhoto
          ? `${baseUrl}/api/profile-photo/${uid}`
          : `${baseUrl}/og-image.png`;
        const fullName =
          `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || "Freelancer";

        // Index only substantive, non-demo profiles: a non-empty bio, at least one
        // skill, or at least one reference. Reference count is only queried when
        // both bio and skills are empty (the expensive path is rarely hit).
        const hasBio = !!(profile.bio && profile.bio.trim());
        const hasSkills = Array.isArray(profile.skills) && profile.skills.length > 0;
        let hasReferences = false;
        if (!hasBio && !hasSkills && !profile.is_demo) {
          hasReferences = (await storage.getFreelancerReferenceCount(uid)) > 0;
        }
        const noindex = !!profile.is_demo || !(hasBio || hasSkills || hasReferences);

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
          noindex,
        });
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      })
      .catch((err) => {
        console.error("OG profile error:", err);
        next();
      });
  };

  if (jobIdMatch) {
    const jobId = parseInt(jobIdMatch[1]);
    if (isNaN(jobId)) return next();
    handleJob(() => storage.getJobById(jobId));
    return;
  }

  if (jobSlugMatch) {
    handleJob(() => storage.getJobBySlug(jobSlugMatch[1]));
    return;
  }

  if (profileIdMatch) {
    const userId = parseInt(profileIdMatch[1]);
    if (isNaN(userId)) return next();
    handleProfile(() => storage.getFreelancerProfile(userId), userId);
    return;
  }

  if (freelancerSlugMatch) {
    handleProfile(() => storage.getFreelancerProfileBySlug(freelancerSlugMatch[1]));
    return;
  }

  if (employerSlugMatch) {
    const slug = employerSlugMatch[1];
    storage
      .getRecruiterProfileBySlug(slug)
      .then((profile) => {
        if (!profile)
          return res.status(200).set({ "Content-Type": "text/html" }).end(buildFallbackHtml());
        const baseUrl = getBaseUrl(req);
        const companyName = profile.company_name || "Event Company";
        const html = buildOgHtml({
          url: `${baseUrl}/employers/${slug}`,
          title: escapeHtml(`${companyName} | EventLink`),
          description: escapeHtml(
            profile.description?.slice(0, 200) || `View ${companyName}'s event jobs on EventLink`
          ),
          imageUrl: profile.company_logo_url || `${baseUrl}/og-image.png`,
          linkText: "View employer on EventLink",
        });
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      })
      .catch((err) => {
        console.error("OG employer error:", err);
        next();
      });
    return;
  }

  const crewMatch = req.path.match(/^\/freelance-crew\/([a-z0-9-]+)$/);
  if (crewMatch) {
    const page = getCrewLandingPage(crewMatch[1]);
    if (!page) {
      return res.status(404).set({ "Content-Type": "text/html" }).end(buildNotFoundHtml());
    }
    const baseUrl = getBaseUrl(req);
    storage
      .searchFreelancers({
        keyword: page.role.searchKeyword || undefined,
        location: page.city.searchLocation,
        page: 1,
        limit: 24,
      })
      .then((search) => {
        const html = buildCrewLandingHtml({ baseUrl, page, freelancers: search.results });
        res.status(200).set({ "Content-Type": "text/html" }).end(html);
      })
      .catch((err) => {
        console.error("OG crew landing error:", err);
        next();
      });
    return;
  }

  if (req.path === "/faq") {
    const baseUrl = getBaseUrl(req);
    res.status(200).set({ "Content-Type": "text/html" }).end(buildFaqPageHtml(baseUrl));
    return;
  }

  const staticPage = STATIC_PAGES[req.path];
  if (staticPage) {
    const baseUrl = getBaseUrl(req);
    const html = buildStaticPageHtml({
      url: `${baseUrl}${req.path}`,
      imageUrl: `${baseUrl}/og-image.png`,
      ...staticPage,
    });
    res.status(200).set({ "Content-Type": "text/html" }).end(html);
    return;
  }

  next();
}

// Minimal noindex page for a genuinely non-existent profile, served with a 404.
function buildNotFoundHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="robots" content="noindex" />
  <title>Profile Not Found | EventLink</title>
</head>
<body>
  <h1>Profile Not Found</h1>
  <p>This profile does not exist or is no longer available on EventLink.</p>
  <a href="https://eventlink.one/freelancers">Browse freelancers on EventLink</a>
</body>
</html>`;
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
