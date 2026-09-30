import type { HelpEntry } from "../types";

const entries: HelpEntry[] = [
  {
    key: "dashboard.tab.applications",
    scope: "feature",
    body: "Everyone who has applied to your live jobs, ready to shortlist or hire.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "dashboard.tab.bookings",
    scope: "feature",
    title: "Bookings",
    body: "Your confirmed crew across jobs, tracked from enquiry through to completed.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "dashboard.tab.crew",
    scope: "feature",
    title: "My Crew",
    body: "The freelancers you have saved or worked with, kept in one place to rebook.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "dashboard.saveFreelancer",
    scope: "action",
    body: "Saves this freelancer to My Crew so you can find them again without searching.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "action.application.hire",
    scope: "action",
    body: "Confirms this freelancer for the job and closes it to new applicants.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "action.application.decline",
    scope: "action",
    body: "Lets the applicant know they weren't selected this time.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "action.application.hide",
    scope: "action",
    body: "Removes this application from your list; the applicant isn't told.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "dashboard.tab.myJobs",
    scope: "feature",
    body: "The jobs you have applied to, with their status and any messages.",
    audience: ["freelancer"],
    version: 1,
  },
];

export default entries;
