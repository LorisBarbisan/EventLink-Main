import { db } from "../config/db";
import { freelancer_profiles, recruiter_profiles, jobs } from "../../../shared/schema";
import { isNull, or, eq, and, not } from "drizzle-orm";
import { generateFreelancerSlug, generateJobSlug, generateEmployerSlug } from "./slugify";

const COUNTRY_CORRECTIONS: { userId: number; country: string }[] = [
  // Force United Kingdom
  { userId: 80, country: "United Kingdom" },
  { userId: 411, country: "United Kingdom" },
  { userId: 343, country: "United Kingdom" },
  { userId: 226, country: "United Kingdom" },
  { userId: 216, country: "United Kingdom" },
  { userId: 219, country: "United Kingdom" },
  // Correct non-UK countries
  { userId: 421, country: "Egypt" },
  { userId: 395, country: "Netherlands" },
  { userId: 387, country: "United Arab Emirates" },
  { userId: 364, country: "South Africa" },
  { userId: 268, country: "Philippines" },
  { userId: 150, country: "United States" },
];

export async function correctCountries() {
  try {
    for (const { userId, country } of COUNTRY_CORRECTIONS) {
      await db
        .update(freelancer_profiles)
        .set({ country })
        .where(eq(freelancer_profiles.user_id, userId));
    }
    console.log(`✅ Country corrections applied for ${COUNTRY_CORRECTIONS.length} profiles`);
  } catch (err) {
    console.error("Country corrections error:", err);
  }
}

async function geocodeCity(city: string): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      q: city,
      format: "json",
      addressdetails: "1",
      limit: "1",
      "accept-language": "en",
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { "User-Agent": "EventLink/1.0 (eventlink.one)" },
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data: any[] = await res.json();
    return data[0]?.address?.country || null;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function backfillCountry() {
  try {
    // Profiles with a location and either no country or the default "United Kingdom"
    // (the first backfill may have incorrectly set non-UK cities to "United Kingdom")
    const withLocation = await db
      .select({ id: freelancer_profiles.id, location: freelancer_profiles.location })
      .from(freelancer_profiles)
      .where(
        and(
          or(
            isNull(freelancer_profiles.country),
            eq(freelancer_profiles.country, ""),
            eq(freelancer_profiles.country, "United Kingdom")
          ),
          not(isNull(freelancer_profiles.location)),
          not(eq(freelancer_profiles.location, ""))
        )
      );

    let geocoded = 0;
    let defaulted = 0;

    for (const profile of withLocation) {
      const country = await geocodeCity(profile.location!);
      await db
        .update(freelancer_profiles)
        .set({ country: country || "United Kingdom" })
        .where(eq(freelancer_profiles.id, profile.id));
      if (country) {
        geocoded++;
      } else {
        defaulted++;
      }
      // Nominatim rate limit: 1 request/second
      await sleep(1100);
    }

    // Profiles with no country and no location — default to United Kingdom
    const noLocation = await db
      .update(freelancer_profiles)
      .set({ country: "United Kingdom" })
      .where(
        and(
          or(isNull(freelancer_profiles.country), eq(freelancer_profiles.country, "")),
          or(isNull(freelancer_profiles.location), eq(freelancer_profiles.location, ""))
        )
      );

    const noLocationCount = (noLocation as any).rowCount ?? 0;
    defaulted += noLocationCount;

    if (geocoded + defaulted > 0) {
      console.log(
        `✅ Country backfill: ${geocoded} geocoded, ${defaulted} defaulted to United Kingdom`
      );
    }
  } catch (err) {
    console.error("Country backfill error:", err);
  }
}

export async function backfillSlugs() {
  try {
    // Backfill freelancer slugs
    const freelancersWithoutSlug = await db
      .select()
      .from(freelancer_profiles)
      .where(isNull(freelancer_profiles.slug));

    let freelancerCount = 0;
    for (const f of freelancersWithoutSlug) {
      const baseSlug = generateFreelancerSlug(f.first_name, f.last_name, f.title);
      if (!baseSlug) continue;
      let slug = baseSlug;
      let counter = 2;
      while (true) {
        const existing = await db
          .select({ id: freelancer_profiles.id })
          .from(freelancer_profiles)
          .where(eq(freelancer_profiles.slug, slug))
          .limit(1);
        if (existing.length === 0) break;
        slug = `${baseSlug}-${counter++}`;
      }
      await db.update(freelancer_profiles).set({ slug }).where(eq(freelancer_profiles.id, f.id));
      freelancerCount++;
    }

    // Backfill recruiter/employer slugs
    const recruitersWithoutSlug = await db
      .select()
      .from(recruiter_profiles)
      .where(isNull(recruiter_profiles.slug));

    let recruiterCount = 0;
    for (const r of recruitersWithoutSlug) {
      if (!r.company_name) continue;
      const baseSlug = generateEmployerSlug(r.company_name);
      let slug = baseSlug;
      let counter = 2;
      while (true) {
        const existing = await db
          .select({ id: recruiter_profiles.id })
          .from(recruiter_profiles)
          .where(eq(recruiter_profiles.slug, slug))
          .limit(1);
        if (existing.length === 0) break;
        slug = `${baseSlug}-${counter++}`;
      }
      await db
        .update(recruiter_profiles)
        .set({ slug } as any)
        .where(eq(recruiter_profiles.id, r.id));
      recruiterCount++;
    }

    // Backfill job slugs
    const jobsWithoutSlug = await db.select().from(jobs).where(isNull(jobs.slug));

    let jobCount = 0;
    for (const j of jobsWithoutSlug) {
      const slug = generateJobSlug(j.title, j.location || "", j.id);
      await db.update(jobs).set({ slug }).where(eq(jobs.id, j.id));
      jobCount++;
    }

    if (freelancerCount + recruiterCount + jobCount > 0) {
      console.log(
        `✅ Slug backfill: ${freelancerCount} freelancers, ${recruiterCount} employers, ${jobCount} jobs`
      );
    }
  } catch (err) {
    console.error("Slug backfill error:", err);
  }
}
