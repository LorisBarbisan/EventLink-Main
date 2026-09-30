import type { HelpEntry } from "../types";

const entries: HelpEntry[] = [
  {
    key: "profile.references",
    scope: "feature",
    title: "References",
    body: "Freelancers with three references get contacted about twice as often.",
    learnMoreHref: "/build-reputation",
    audience: ["freelancer"],
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
];

export default entries;
