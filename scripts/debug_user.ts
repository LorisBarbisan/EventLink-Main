import { eq, sql } from "drizzle-orm";
import { db } from "../server/api/config/db";
import { users, freelancer_profiles, job_applications, jobs } from "../shared/schema";

async function main() {
  const email = process.argv[2] || "duncangreenway@gmail.com";
  const userRows = await db
    .select()
    .from(users)
    .where(sql`LOWER(${users.email}) = ${email.toLowerCase()}`);
  console.log("USER:", JSON.stringify(userRows, null, 2));

  if (userRows[0]) {
    const uid = userRows[0].id;
    const profile = await db
      .select()
      .from(freelancer_profiles)
      .where(eq(freelancer_profiles.user_id, uid));
    console.log("PROFILE:", profile.length ? JSON.stringify(profile[0], null, 2) : "NO PROFILE");

    const apps = await db
      .select({
        id: job_applications.id,
        job_id: job_applications.job_id,
        status: job_applications.status,
        freelancer_deleted: job_applications.freelancer_deleted,
        job_title: jobs.title,
        job_status: jobs.status,
      })
      .from(job_applications)
      .leftJoin(jobs, eq(jobs.id, job_applications.job_id))
      .where(eq(job_applications.freelancer_id, uid));
    console.log("APPLICATIONS:", JSON.stringify(apps, null, 2));
  }
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
