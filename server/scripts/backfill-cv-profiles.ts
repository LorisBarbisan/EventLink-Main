// ============================================================
// One-off: apply already-parsed CV data to specific freelancers' profiles — for
// users who uploaded a CV but still have sparse profiles.
//
// Preserves what they may have set themselves:
//   • NAME  — filled only if the profile currently has no name.
//   • PROFESSIONAL TITLE — filled only if the profile currently has no title.
//   • SUPERPOWER — never touched (CV parsing doesn't produce one).
// Everything else the parse extracted (skills, bio, location, country,
// experience, work history, education, certifications) is applied.
//
// It uses the extracted data already stored in cv_parsed_data — it does NOT
// re-run the AI parser. Users with no stored parse data are reported and skipped.
//
// Dry-run by default (prints what WOULD change). Pass --send to apply.
//
// Usage (DATABASE_URL set, or linked to the Railway project):
//   npx tsx server/scripts/backfill-cv-profiles.ts
//   railway run npx tsx server/scripts/backfill-cv-profiles.ts --send
// ============================================================

import { storage } from "../storage";

const USER_IDS = [629, 631, 632, 638, 640, 641, 643, 648];
const SEND = process.argv.includes("--send");

function parseJson(value: string): unknown {
  try {
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return value;
  }
}

async function run() {
  console.log(`CV→profile backfill — ${USER_IDS.length} users, mode ${SEND ? "SEND" : "DRY-RUN"}`);

  let applied = 0;
  for (const userId of USER_IDS) {
    const profile = await storage.getFreelancerProfile(userId);
    if (!profile) {
      console.log(`  user ${userId}: no freelancer profile — skip`);
      continue;
    }

    const cv = await storage.getCvParsedData(userId);
    if (!cv) {
      console.log(`  user ${userId}: no stored CV parse data — skip (needs a (re)parse)`);
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updates: Record<string, any> = {};

    // Name — only when the profile has none.
    const hasName = !!(profile.first_name?.trim() || profile.last_name?.trim());
    if (!hasName && cv.extracted_full_name?.trim()) {
      const parts = cv.extracted_full_name.trim().split(/\s+/);
      updates.first_name = parts[0];
      updates.last_name = parts.slice(1).join(" ") || null;
    }

    // Professional title — only when the profile has none.
    if (!profile.title?.trim() && cv.extracted_title?.trim()) {
      updates.title = cv.extracted_title.trim();
    }

    // Superpower is intentionally left as-is.

    // Everything else the parse found.
    if (cv.extracted_skills?.length) updates.skills = cv.extracted_skills;
    if (cv.extracted_bio?.trim()) updates.bio = cv.extracted_bio;
    if (cv.extracted_location?.trim()) updates.location = cv.extracted_location;
    if (cv.extracted_country?.trim()) updates.country = cv.extracted_country;
    if (cv.extracted_experience_years != null) {
      updates.experience_years = cv.extracted_experience_years;
    }
    if (cv.extracted_certifications?.length) updates.certifications = cv.extracted_certifications;
    if (cv.extracted_work_history) updates.work_history = parseJson(cv.extracted_work_history);
    if (cv.extracted_education) updates.education_history = parseJson(cv.extracted_education);

    const changed = Object.keys(updates);
    if (changed.length === 0) {
      console.log(
        `  user ${userId}: nothing to apply (no extracted fields, or already populated) — skip`
      );
      continue;
    }

    console.log(`  user ${userId}: ${SEND ? "applying" : "would apply"} → ${changed.join(", ")}`);
    if (SEND) {
      await storage.updateFreelancerProfile(userId, updates);
      await storage.updateCvParsedData(userId, { status: "confirmed" });
      applied++;
    }
  }

  console.log(
    SEND
      ? `✅ Done — applied to ${applied} user(s).`
      : "Dry-run complete — re-run with --send to apply."
  );
}

run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("backfill-cv-profiles failed:", err);
    process.exit(1);
  });
