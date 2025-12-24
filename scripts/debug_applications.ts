
import { desc, eq } from "drizzle-orm";
import { db } from "../server/api/config/db";
import { job_applications, jobs, users } from "../shared/schema";

async function debugApplications() {
  console.log("🔍 Debugging Applications...");

  // 1. List all freelancers
  const freelancers = await db.select().from(users).where(eq(users.role, "freelancer"));
  console.log(`\nFound ${freelancers.length} freelancers:`);

  for (const f of freelancers) {
    console.log(`- [${f.id}] ${f.first_name} ${f.last_name} (${f.email})`);

    // 2. Get applications for this freelancer
    const apps = await db
      .select({
        id: job_applications.id,
        job_id: job_applications.job_id,
        status: job_applications.status,
        job_title: jobs.title,
        recruiter_deleted: job_applications.recruiter_deleted,
        freelancer_deleted: job_applications.freelancer_deleted,
        applied_at: job_applications.applied_at
      })
      .from(job_applications)
      .leftJoin(jobs, eq(jobs.id, job_applications.job_id))
      .where(eq(job_applications.freelancer_id, f.id))
      .orderBy(desc(job_applications.applied_at));

    console.log(`  Found ${apps.length} applications:`);
    apps.forEach(app => {
      console.log(`    - App ID: ${app.id}, Job: ${app.job_title} (#${app.job_id}), Status: ${app.status}, F-Deleted: ${app.freelancer_deleted}`);
    });
  }

  // 3. Inspect Jobs
  const allJobs = await db.select().from(jobs);
  const internalJobs = allJobs.filter(j => !j.external_url);
  const externalJobs = allJobs.filter(j => !!j.external_url);

  console.log(`\nJob Analysis:`);
  console.log(`- Total Jobs: ${allJobs.length}`);
  console.log(`- Internal Jobs: ${internalJobs.length}`);
  console.log(`- External Jobs: ${externalJobs.length}`);

  if (internalJobs.length > 0) {
    console.log(`\nInternal Jobs Sample (Apply to these to test ratings):`);
    internalJobs.slice(0, 5).forEach(j => {
      console.log(`- [${j.id}] ${j.title} (${j.company})`);
    });
  }

  console.log("\nDone.");
  process.exit(0);
}

debugApplications().catch(console.error);
