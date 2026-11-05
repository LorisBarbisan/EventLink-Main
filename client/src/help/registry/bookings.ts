import type { HelpEntry } from "../types";

// Booking pipeline states — explain what each stage means in the workflow,
// never just restate the label.
const entries: HelpEntry[] = [
  {
    key: "bookings.status.enquired",
    scope: "feature",
    title: "Enquired",
    body: "You've been in touch, but nothing is agreed yet.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "bookings.status.confirmed",
    scope: "feature",
    title: "Confirmed",
    body: "The freelancer is booked for this job at the agreed terms.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "bookings.status.briefed",
    scope: "feature",
    title: "Briefed",
    body: "Call times and details have gone out; they're ready for the day.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "bookings.status.completed",
    scope: "feature",
    title: "Completed",
    body: "The work is done — a good moment to leave a rating.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
  {
    key: "bookings.status.cancelled",
    scope: "feature",
    title: "Cancelled",
    body: "This booking won't go ahead; it stays here for your records.",
    audience: ["recruiter", "admin"],
    version: 1,
  },
];

export default entries;
