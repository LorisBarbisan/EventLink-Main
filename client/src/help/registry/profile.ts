import type { HelpEntry } from "../types";

const entries: HelpEntry[] = [
  {
    key: "profile.references",
    scope: "feature",
    title: "References",
    body: "Freelancers with three references get contacted about twice as often. Ask for one.",
    learnMoreHref: "/build-reputation",
    audience: ["freelancer"],
    // Discovery-eligible: a high-value, under-used feature.
    priority: 10,
    oncePerUser: true,
    minVisits: 2,
    maxVisits: 12,
    version: 1,
  },
  {
    key: "profile.availability",
    scope: "feature",
    body: "Marks you as open to work so employers filtering for availability find you.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "form.profile.superpower",
    scope: "field",
    body: "The one thing you are best at; it is the first line employers read.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "form.profile.skills",
    scope: "field",
    body: "Employers search on these, so list the kit and roles you actually work with.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "form.profile.day_rate",
    scope: "field",
    body: "Your standard daily fee; you can still agree a different rate per booking.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "form.profile.location",
    scope: "field",
    body: "Your base, used to match you to work within travelling distance.",
    version: 1,
  },
  {
    key: "form.profile.company_name",
    scope: "field",
    body: "The name freelancers see on your jobs and messages.",
    audience: ["recruiter"],
    version: 1,
  },
  {
    key: "form.profile.title",
    scope: "field",
    body: "How you want to be found — e.g. 'Lighting Designer', not your whole CV.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "form.profile.company_type",
    scope: "field",
    body: "Tells freelancers the kind of outfit they'd be working for.",
    audience: ["recruiter"],
    version: 1,
  },
  {
    key: "action.profile.shareLink",
    scope: "action",
    body: "Copies your public profile link to share with employers off-platform.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "action.profile.viewPublic",
    scope: "action",
    body: "Opens your profile exactly as employers see it.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "action.freelancer.postJob",
    scope: "action",
    body: "Post your own gig — useful when you're sub-contracting or building a team.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "action.reference.request",
    scope: "action",
    body: "Ask a past employer to vouch for you; three references roughly doubles your enquiries.",
    audience: ["freelancer"],
    version: 1,
  },
];

export default entries;
