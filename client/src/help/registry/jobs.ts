import type { HelpEntry } from "../types";

// Copy rules (epic §8): one sentence, say what it does for the user, British
// English, no "click here", never restate the label.
const entries: HelpEntry[] = [
  {
    key: "jobs.filter.radius",
    scope: "feature",
    body: "Shows you jobs within travelling distance of your base, not just your town.",
    version: 1,
  },
  {
    key: "jobs.filter.country",
    scope: "feature",
    body: "Narrows results to a single country when you work across borders.",
    version: 1,
  },
  {
    key: "jobs.status.closed",
    scope: "feature",
    title: "Closed job",
    body: "This job is no longer taking applications, but its applicants stay on your record.",
    version: 1,
  },
  {
    key: "action.job.notify",
    scope: "action",
    title: "Notify freelancers",
    body: "Emails matching freelancers about this opening so it fills faster.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "action.job.invite",
    scope: "action",
    body: "Ask a specific freelancer to apply, even if they weren't searching for work.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "action.job.close",
    scope: "action",
    body: "Stops new applications and invitations; the job and its applicants stay on your dashboard.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "action.job.reopen",
    scope: "action",
    body: "Brings a closed job back as an unposted draft so you can edit and re-post it.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "action.job.duplicate",
    scope: "action",
    body: "Starts a new job pre-filled from this one — quick for recurring gigs.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "action.job.docs",
    scope: "action",
    body: "Attach call sheets or purchase orders; hired crew can download them.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "action.job.post",
    scope: "action",
    body: "Makes the job visible to freelancers on the Find Jobs page.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "action.job.unpost",
    scope: "action",
    body: "Hides the job from Find Jobs; it stays reachable by invitation only.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  // Auto-covered post-a-job form fields (key = form.<namespace>.<field>).
  {
    key: "form.postJob.rate",
    scope: "field",
    body: "The pay you are offering, before agency fees — freelancers filter on this.",
    version: 1,
  },
  {
    key: "form.postJob.location",
    scope: "field",
    body: "Where the work happens; it sets which freelancers see the job by distance.",
    version: 1,
  },
  {
    key: "form.postJob.event_date",
    scope: "field",
    body: "The day the crew is needed; jobs close automatically once this date passes.",
    version: 1,
  },
  {
    key: "form.postJob.description",
    scope: "field",
    body: "Call times, kit and dress code here get you fewer questions and better applicants.",
    version: 1,
  },
];

export default entries;
