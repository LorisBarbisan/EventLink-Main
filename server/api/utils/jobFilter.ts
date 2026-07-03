/**
 * Pure event-industry job filtering logic. Deliberately has no imports on
 * storage/db so it can be exercised by a standalone script (jobFilterCheck.ts)
 * without needing a live database connection.
 */

// Keywords that indicate event industry roles
const EVENT_ROLE_KEYWORDS = [
  // Core specified roles
  "av technician",
  "audio visual",
  "audiovisual technician",
  "event technician",
  "event production",
  "production technician",
  "sound engineer",
  "audio engineer",
  "lighting technician",
  "lighting engineer",
  "lighting operator",
  "video technician",
  "vision mixer",
  "vmix",
  "broadcast technician",
  "live events technician",
  "conference av",
  "technical crew",
  "stage technician",
  "led technician",
  "projection technician",

  // Related technical roles
  "sound technician",
  "audio technician",
  "live streaming",
  "live production",
  "production crew",
  "production assistant",
  "technical support",
  "technical coordinator",
  "camera operator",
  "video operator",
  "video mixer",
  "video engineer",
  "streaming engineer",
  "stage manager",
  "stage management",
  "production manager",

  // Equipment and venue specific
  "rigging",
  "conference technician",
  // Broadcasting and media
  "video production",
  "live broadcast",
  "streaming technician",
  "media technician",

  // Technical equipment signals (strong positive indicators)
  "mixing desk",
  "pa system",
  "lighting desk",
  "grandma",
  "avolites",
  "led wall",
  "projectors",
  "cameras",
  "signal flow",
  "rf microphones",
  "live stream",
  "vision mixing",
];

// Keywords that indicate NON-event industry roles (catering, hospitality, etc.) that should be excluded
const EXCLUDE_KEYWORDS = [
  // Marketing and sales
  "marketing",
  "digital marketing",
  "brand",
  "brand ambassador",
  "sales",
  "sales executive",
  "promotion",
  "promotional",
  "public relations",
  "social media",
  "content creator",

  // Hospitality and catering
  "hospitality",
  "hotel",
  "restaurant",
  "waiter",
  "waitress",
  "front of house",
  "venue assistant",
  "event host",
  "wedding",
  "festival",
  "catering",
  "chef",
  "head chef",
  "sous chef",
  "cook",
  "kitchen",
  "culinary",
  "banquet",
  "menu",
  "dining",
  "bartender",
  "barista",
  "food service",
  "food preparation",
  "pastry chef",

  // Management and coordination roles
  "event manager",
  "events manager",
  "event coordinator",
  "events coordinator",
  "project manager",
  "account manager",
  "client services",

  // Administrative and office roles
  "administrator",
  "human resources",

  // General hospitality services
  "front desk",
  "housekeeping",
  "concierge",
  "guest services",
  "accommodation",

  // Other non-technical roles
  "cleaning",
  "security guard",
  "bouncer",
  "steward",
  "usher",
  "ticket sales",
  "customer service",

  // Marketing/business signals (strong negative indicators)
  "campaign",
  "marketing strategy",
  "kpis",
  "pipeline",
  "lead generation",
  "customer acquisition",
  "content calendar",

  // Developer/IT roles
  "developer",
  "software developer",
  "web developer",
  "frontend developer",
  "backend developer",
  "full stack developer",
  "programmer",
  "software engineer",
  "devops",
  "data engineer",
  "data scientist",
  "machine learning",
  "python developer",
  "javascript developer",
  "react developer",
  "node developer",
  "java developer",
  "coding",
];

// Adzuna category tags that reliably indicate a non-event-industry job.
// Reed's public search API doesn't expose a per-job category, so this gate
// only applies to Adzuna results. Deliberately excludes ambiguous categories
// (e.g. "engineering-jobs", "creative-design-jobs", "it-jobs") that genuinely
// contain AV/broadcast roles mixed with irrelevant ones — live testing found
// a real "Senior AV Technician" posting tagged "it-jobs" by Adzuna, so that
// category falls through to scoring rather than being hard-excluded.
export const ADZUNA_EXCLUDED_CATEGORIES = new Set([
  "catering-jobs",
  "hospitality-catering-jobs",
  "pr-advertising-marketing-jobs",
  "sales-jobs",
  "admin-jobs",
  "hr-jobs",
  "retail-jobs",
  "customer-services-jobs",
  "healthcare-nursing-jobs",
  "teaching-jobs",
  "accounting-finance-jobs",
  "charity-voluntary-jobs",
  "legal-jobs",
  "social-work-jobs",
  "domestic-help-cleaning-jobs",
  "travel-jobs",
  // Live testing found a real "Production Technician (Sprayer)" (BAE Systems,
  // factory paint shop) tagged manufacturing-jobs. "Production Technician" is
  // a legitimate title in both AV/events and factory work, but Adzuna's own
  // manufacturing-jobs category reliably means the latter.
  "manufacturing-jobs",
]);

export interface ScorableJob {
  title: string;
  description: string;
  categoryTag?: string;
}

export interface JobScoreBreakdown {
  titleIncludeHits: string[];
  descIncludeHits: string[];
  titleExcludeHits: string[];
  descExcludeHits: string[];
  score: number;
  included: boolean;
}

/**
 * Scores a job's relevance to the event-tech industry. Title hits are weighted
 * far more heavily than description hits since job titles are concise/curated,
 * while descriptions are long free text where a single stray word (positive or
 * negative) shouldn't swing the whole decision — hence the score threshold
 * instead of a flat include/exclude keyword gate.
 */
export function scoreJob(job: ScorableJob): JobScoreBreakdown {
  const titleLower = job.title.toLowerCase();
  const descLower = job.description.toLowerCase();

  const titleIncludeHits = EVENT_ROLE_KEYWORDS.filter((k) => titleLower.includes(k));
  const descIncludeHits = EVENT_ROLE_KEYWORDS.filter((k) => descLower.includes(k));
  const titleExcludeHits = EXCLUDE_KEYWORDS.filter((k) => titleLower.includes(k));
  const descExcludeHits = EXCLUDE_KEYWORDS.filter((k) => descLower.includes(k));

  const score =
    titleIncludeHits.length * 3 +
    Math.min(descIncludeHits.length, 3) * 1 +
    titleExcludeHits.length * -5 +
    Math.min(descExcludeHits.length, 3) * -1;

  return {
    titleIncludeHits,
    descIncludeHits,
    titleExcludeHits,
    descExcludeHits,
    score,
    included: score >= 3,
  };
}

/**
 * Filters a batch of jobs, logging the reasoning for each decision.
 * Adzuna jobs are gated on their structured category first (a stronger
 * signal than keyword sniffing); everything else falls through to scoreJob.
 */
export function filterEventIndustryJobs<T extends ScorableJob & { title: string; company: string }>(
  jobs: T[]
): T[] {
  console.log(`Filtering ${jobs.length} jobs for event industry roles...`);

  const filteredJobs = jobs.filter((job) => {
    if (job.categoryTag && ADZUNA_EXCLUDED_CATEGORIES.has(job.categoryTag)) {
      console.log(
        `✗ Excluding job (blocked category "${job.categoryTag}"): ${job.title} (${job.company})`
      );
      return false;
    }

    const breakdown = scoreJob(job);
    const detail =
      `[titleIn:${breakdown.titleIncludeHits.join(",") || "-"} descIn:${breakdown.descIncludeHits.join(",") || "-"} ` +
      `titleEx:${breakdown.titleExcludeHits.join(",") || "-"} descEx:${breakdown.descExcludeHits.join(",") || "-"}]`;

    if (breakdown.included) {
      console.log(
        `✓ Keeping job: ${job.title} (${job.company}) — score ${breakdown.score} ${detail}`
      );
    } else {
      console.log(
        `✗ Excluding job (score ${breakdown.score} < 3): ${job.title} (${job.company}) ${detail}`
      );
    }

    return breakdown.included;
  });

  console.log(`Filtered down to ${filteredJobs.length} event industry jobs`);
  return filteredJobs;
}
