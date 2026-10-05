// Single source of truth for the SEO "freelance crew" landing pages
// (role × city). Consumed by:
//   • the client route/template (client/src/pages/CrewLanding.tsx + App.tsx)
//   • the internal-link blocks (Footer, /freelancers "Browse by …")
//   • the crawler-prerender middleware (server/api/middleware/ogTags.ts)
//   • the sitemap generator (server/api/routes/seo.route.ts)
//
// Adding a role or city here wires up the page everywhere at once. Keep this
// file free of React / server imports so both sides can use it.

export interface CrewRole {
  slug: string; // URL segment, e.g. "av-technician"
  heading: string; // Title-case label for <title>/<h1>, e.g. "AV Technicians"
  descLabel: string; // lower-case plural for prose, e.g. "AV technicians"
  /** Keyword passed to /api/freelancers/search. Empty = city-only (umbrella).
   *  Deliberately broad so the embedded list isn't thin; tune as data grows. */
  searchKeyword: string;
  /** How the how-it-works paragraph refers to the person you message. */
  messageWord: string;
}

export interface CrewCity {
  slug: string; // URL segment, e.g. "london"
  name: string; // Display name, e.g. "London"
  /** Location filter passed to /api/freelancers/search. */
  searchLocation: string;
}

export const CREW_ROLES: CrewRole[] = [
  {
    slug: "event-crew",
    heading: "Event Crew",
    descLabel: "event crew",
    searchKeyword: "",
    messageWord: "the crew",
  },
  {
    slug: "av-technician",
    heading: "AV Technicians",
    descLabel: "AV technicians",
    searchKeyword: "AV",
    messageWord: "a technician",
  },
  {
    slug: "sound-engineer",
    heading: "Sound Engineers",
    descLabel: "sound engineers",
    searchKeyword: "Sound",
    messageWord: "a sound engineer",
  },
];

export const CREW_CITIES: CrewCity[] = [
  { slug: "london", name: "London", searchLocation: "London" },
  { slug: "manchester", name: "Manchester", searchLocation: "Manchester" },
  { slug: "birmingham", name: "Birmingham", searchLocation: "Birmingham" },
];

export interface CrewLandingPage {
  slug: string; // "av-technician-london"
  path: string; // "/freelance-crew/av-technician-london"
  role: CrewRole;
  city: CrewCity;
  title: string; // <title>
  h1: string;
  metaDescription: string;
  intro: string; // Paragraph 1 — role/city-specific pain point
  howItWorks: string; // Paragraph 2 — Trust & Vetting, kept short
  browseCtaLabel: string; // "Browse London AV technicians"
  postCtaLabel: string; // "Post an AV job in London"
}

export const CREW_LANDING_BASE = "/freelance-crew";

// Role-specific intro copy. Each takes the city name and follows the same shape,
// swapping the pain point per role (AV/short-notice, sound/line-check,
// crew/load-in). The AV wording is the drafted template, verbatim.
function buildIntro(roleSlug: string, city: string): string {
  switch (roleSlug) {
    case "av-technician":
      return `${city}'s events calendar doesn't slow down, and finding an AV technician who's actually free — and actually good — on short notice is the usual bottleneck. EventLink lists freelance AV technicians across ${city} with verified work history, credential badges, and reliability ratings from past jobs, so you're not hiring on a CV alone.`;
    case "sound-engineer":
      return `In ${city}, a show lives or dies on the last-minute line check — and the sound engineer who can walk in, patch up, and deliver a clean mix under time pressure is the one everyone wants. EventLink lists freelance sound engineers across ${city} with verified work history, credential badges, and reliability ratings from past jobs, so you're not hiring on a CV alone.`;
    case "event-crew":
    default:
      return `${city}'s events calendar doesn't slow down, and crewing up fast for a load-in — with people who actually turn up and know the room — is the usual bottleneck. EventLink lists freelance event crew across ${city} with verified work history, credential badges, and reliability ratings from past jobs, so you're not hiring on a CV alone.`;
  }
}

function buildHowItWorks(role: CrewRole): string {
  return `Every profile shows real reference checks and post-job ratings through EventLink's Trust & Vetting system — not just a self-written bio. Filter by availability and experience, message ${role.messageWord} directly, and confirm the booking without a recruiter in between.`;
}

function buildPage(role: CrewRole, city: CrewCity): CrewLandingPage {
  const slug = `${role.slug}-${city.slug}`;
  return {
    slug,
    path: `${CREW_LANDING_BASE}/${slug}`,
    role,
    city,
    title: `Freelance ${role.heading} in ${city.name} | EventLink`,
    h1: `Freelance ${role.heading} in ${city.name}`,
    metaDescription: `Find vetted freelance ${role.descLabel} in ${city.name} on EventLink. Browse verified profiles, check availability, and hire crew who show up ready to work.`,
    intro: buildIntro(role.slug, city.name),
    howItWorks: buildHowItWorks(role),
    browseCtaLabel: `Browse ${city.name} ${role.descLabel}`,
    postCtaLabel: `Post ${role.slug === "event-crew" ? "an event crew" : role.slug === "av-technician" ? "an AV" : "a sound"} job in ${city.name}`,
  };
}

// All role × city combinations, in a stable order (role-major, then city).
export const CREW_LANDING_PAGES: CrewLandingPage[] = CREW_ROLES.flatMap((role) =>
  CREW_CITIES.map((city) => buildPage(role, city))
);

const PAGES_BY_SLUG: Record<string, CrewLandingPage> = Object.fromEntries(
  CREW_LANDING_PAGES.map((p) => [p.slug, p])
);

/** Look up a landing page by its combined "{role}-{city}" slug, or null. */
export function getCrewLandingPage(slug: string | undefined): CrewLandingPage | null {
  if (!slug) return null;
  return PAGES_BY_SLUG[slug] ?? null;
}

/** Sibling pages used for the on-page internal-link cluster: same city (other
 *  roles) plus same role (other cities), so pages link to genuine neighbours. */
export function getRelatedCrewPages(page: CrewLandingPage): CrewLandingPage[] {
  const related = CREW_LANDING_PAGES.filter(
    (p) =>
      p.slug !== page.slug && (p.city.slug === page.city.slug || p.role.slug === page.role.slug)
  );
  // Same-city first, then same-role, matching how the cluster reads.
  return related.sort((a, b) => {
    const aCity = a.city.slug === page.city.slug ? 0 : 1;
    const bCity = b.city.slug === page.city.slug ? 0 : 1;
    return aCity - bCity;
  });
}
