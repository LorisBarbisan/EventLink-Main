import { db } from "../config/db";
import { freelancer_profiles, recruiter_profiles, jobs } from "../../../shared/schema";
import { isNull, or, eq } from "drizzle-orm";
import { generateFreelancerSlug, generateJobSlug, generateEmployerSlug } from "./slugify";

export async function backfillCountry() {
  try {
    const result = await db
      .update(freelancer_profiles)
      .set({ country: "United Kingdom" })
      .where(or(isNull(freelancer_profiles.country), eq(freelancer_profiles.country, "")));
    console.log(
      `✅ Country backfill: set United Kingdom on ${(result as any).rowCount ?? "?"} profiles`
    );
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
