/**
 * Pure event-industry job filtering logic. Deliberately has no imports on
 * storage/db so it can be exercised by a standalone script (jobFilterCheck.ts)
 * without needing a live database connection.
 */

// Terms that are genuinely unambiguous to live events / AV / broadcast /
// touring / production work — gear and software brand names, and job titles
// that aren't meaningfully used outside this industry. A single hit here is
// enough to include a job on its own (see scoreJob's weighting).
const STRONG_EVENT_KEYWORDS = [
  // Roles specific to AV/events/broadcast
  "av technician",
  "audio visual technician",
  "audiovisual technician",
  "av engineer",
  "av installation engineer",
  "av support engineer",
  "conference av technician",
  "conference av",
  "exhibition av technician",
  "event av technician",
  "event av",
  "live events technician",
  "live event technician",
  "event technician",
  "foh engineer",
  "front of house engineer",
  "monitor engineer",
  "audio system engineer",
  "sound engineer",
  "audio engineer",
  "broadcast engineer",
  "broadcast technician",
  "vision mixer",
  "vision engineer",
  "vision mixing",
  "playout engineer",
  "evs operator",
  "lighting technician",
  "lighting engineer",
  "lighting designer",
  "lighting operator",
  "moving light technician",
  "moving lights",
  "rigging technician",
  "truss technician",
  "truss rigger",
  "event rigger",
  "stage technician",
  "backline technician",
  "backline tech",
  "tour manager",
  "production electrician",
  "streaming technician",
  "streaming engineer",
  "webcast engineer",
  "ob engineer",
  "outside broadcast engineer",
  "ob technician",
  "outside broadcast",
  "satellite truck operator",
  "projectionist",
  "projection technician",
  "led wall technician",
  "led screen technician",
  "led technician",
  "video engineer",
  "live camera operator",
  "broadcast camera operator",
  "studio camera operator",
  "ob camera operator",
  "vmix",
  "dry hire technician",
  "festival crew",
  "touring crew",
  "arena tour",
  "corporate av",
  "trade show av",
  "exhibition stand build",
  "stage management",
  "stage manager",

  // Gear, software and brand names essentially unique to this industry
  "grandma2",
  "grandma3",
  "grandma",
  "avolites",
  "hog console",
  "hog 4",
  "chamsys",
  "eos console",
  "etc eos",
  "colorsource console",
  "disguise media server",
  "d3 media server",
  "resolume",
  "qlab",
  "dante audio",
  "madi",
  "digico",
  "allen & heath",
  "midas console",
  "yamaha cl5",
  "yamaha ql5",
  "l-acoustics",
  "d&b audiotechnik",
  "meyer sound",
  "clear-com",
  "riedel comms",
  "blackmagic atem",
  "atem switcher",
  "ross switcher",
  "line array",
  "pa system",
  "in-ear monitors",
  "iem pack",
  "ground support",
  "flying rig",
  "chain hoist",
  "pixel mapping",
  "rf coordination",
  "wireless frequency coordination",
  "signal flow",
  "mixing desk",
  "lighting desk",
  "rf microphones",
  "led wall",
];

// Terms that relate to events/production but are also common in unrelated
// industries (manufacturing, agriculture, warehousing, IT, construction).
// A hit here alone isn't enough to include a job — see scoreJob's weighting.
const WEAK_EVENT_KEYWORDS = [
  "production technician",
  "production crew",
  "production manager",
  "production assistant",
  "production support",
  "technical support",
  "technical coordinator",
  "technical crew",
  "camera operator",
  "video operator",
  "video mixer",
  "sound technician",
  "audio technician",
  "live streaming",
  "live production",
  "live broadcast",
  "video production",
  "media technician",
  "event production",
  "conference technician",
  "rigging",
  "cameras",
  "projectors",
  "media server",
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

  // Agriculture and farming — "production technician/crew/manager" style
  // titles are also routinely used on farms, so these need an explicit
  // negative signal since they'd otherwise pass on weak-keyword overlap alone
  "farm",
  "farming",
  "farmer",
  "agricultural",
  "agriculture",
  "livestock",
  "dairy",
  "poultry",
  "arable",
  "harvest",
  "crop",
  "horticulture",
  "abattoir",
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
  titleStrongHits: string[];
  descStrongHits: string[];
  titleWeakHits: string[];
  descWeakHits: string[];
  titleExcludeHits: string[];
  descExcludeHits: string[];
  score: number;
  included: boolean;
}

/**
 * Scores a job's relevance to the event-tech industry using two keyword
 * tiers rather than one flat list. Strong terms (gear/software brand names,
 * roles unique to this industry) are unambiguous enough that a single hit is
 * sufficient on its own. Weak terms ("production technician", "camera
 * operator", etc.) are genuinely used across other industries too — factory,
 * farm and warehouse job titles routinely overlap with them — so they only
 * count when there's enough of them to add up, or when paired with a strong
 * hit. This directly targets false positives found in production: a
 * manufacturing "Production Technician (Sprayer)" and a farm-adjacent
 * "Production" role both matched on weak-tier phrases alone with nothing to
 * corroborate them.
 */
export function scoreJob(job: ScorableJob): JobScoreBreakdown {
  const titleLower = job.title.toLowerCase();
  const descLower = job.description.toLowerCase();

  const titleStrongHits = STRONG_EVENT_KEYWORDS.filter((k) => titleLower.includes(k));
  const descStrongHits = STRONG_EVENT_KEYWORDS.filter((k) => descLower.includes(k));
  const titleWeakHits = WEAK_EVENT_KEYWORDS.filter((k) => titleLower.includes(k));
  const descWeakHits = WEAK_EVENT_KEYWORDS.filter((k) => descLower.includes(k));
  const titleExcludeHits = EXCLUDE_KEYWORDS.filter((k) => titleLower.includes(k));
  const descExcludeHits = EXCLUDE_KEYWORDS.filter((k) => descLower.includes(k));

  const score =
    titleStrongHits.length * 6 +
    Math.min(descStrongHits.length, 2) * 3 +
    titleWeakHits.length * 2 +
    Math.min(descWeakHits.length, 3) * 1 +
    titleExcludeHits.length * -8 +
    Math.min(descExcludeHits.length, 3) * -2;

  return {
    titleStrongHits,
    descStrongHits,
    titleWeakHits,
    descWeakHits,
    titleExcludeHits,
    descExcludeHits,
    score,
    included: score >= 6,
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
      `[titleStrong:${breakdown.titleStrongHits.join(",") || "-"} descStrong:${breakdown.descStrongHits.join(",") || "-"} ` +
      `titleWeak:${breakdown.titleWeakHits.join(",") || "-"} descWeak:${breakdown.descWeakHits.join(",") || "-"} ` +
      `titleEx:${breakdown.titleExcludeHits.join(",") || "-"} descEx:${breakdown.descExcludeHits.join(",") || "-"}]`;

    if (breakdown.included) {
      console.log(
        `✓ Keeping job: ${job.title} (${job.company}) — score ${breakdown.score} ${detail}`
      );
    } else {
      console.log(
        `✗ Excluding job (score ${breakdown.score} < 6): ${job.title} (${job.company}) ${detail}`
      );
    }

    return breakdown.included;
  });

  console.log(`Filtered down to ${filteredJobs.length} event industry jobs`);
  return filteredJobs;
}
