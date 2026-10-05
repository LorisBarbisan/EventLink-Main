import { initGA } from "./analytics";

// UK PECR/GDPR: analytics (Google Analytics) and advertising (LinkedIn
// Insight Tag) cookies may only be set after the visitor opts in. The
// essential session cookie is exempt and unaffected by this module.

export type ConsentChoice = "accepted" | "rejected";

const STORAGE_KEY = "eventlink_cookie_consent";
// ICO guidance: consent should be refreshed periodically
const CONSENT_MAX_AGE_MS = 365 * 24 * 60 * 60 * 1000;

interface StoredConsent {
  choice: ConsentChoice;
  date: string;
}

export function getCookieConsent(): ConsentChoice | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const stored: StoredConsent = JSON.parse(raw);
    if (stored.choice !== "accepted" && stored.choice !== "rejected") return null;
    if (Date.now() - new Date(stored.date).getTime() > CONSENT_MAX_AGE_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return stored.choice;
  } catch {
    return null;
  }
}

export function setCookieConsent(choice: ConsentChoice): void {
  const stored: StoredConsent = { choice, date: new Date().toISOString() };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
  if (choice === "accepted") {
    initTrackers();
  }
}

let trackersLoaded = false;

/** Load GA and the LinkedIn Insight Tag. Call only after the visitor accepts. */
export function initTrackers(): void {
  if (trackersLoaded) return;
  trackersLoaded = true;
  initGA();
  initLinkedInInsight();
}

// Replicates the standard LinkedIn Insight Tag snippet, previously inlined
// in index.html where it fired for every visitor without consent.
function initLinkedInInsight(): void {
  const w = window as any;
  w._linkedin_partner_id = "9014706";
  w._linkedin_data_partner_ids = w._linkedin_data_partner_ids || [];
  w._linkedin_data_partner_ids.push(w._linkedin_partner_id);
  if (!w.lintrk) {
    w.lintrk = function (a: any, b: any) {
      w.lintrk.q.push([a, b]);
    };
    w.lintrk.q = [];
  }
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.async = true;
  script.src = "https://snap.licdn.com/li.lms-analytics/insight.min.js";
  document.head.appendChild(script);
}
