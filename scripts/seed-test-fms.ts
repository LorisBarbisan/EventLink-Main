/**
 * Seed script: create FMS test accounts for end-to-end testing.
 *
 * Accounts created (password: TestFMS2024!):
 *   fms-employer@test.eventlink.com  — recruiter, FMS-subscribed
 *   fms-crew1@test.eventlink.com     — freelancer (camera op)
 *   fms-crew2@test.eventlink.com     — freelancer (sound engineer)
 *
 * Both freelancers are saved to the employer's crew so the
 * Invite Crew button and availability matrix work immediately.
 *
 * A subscription row is inserted via raw SQL because the worktree
 * schema doesn't include the subscriptions table (it lives in FMS1).
 *
 * Usage:
 *   npx tsx scripts/seed-test-fms.ts
 */

import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../server/api/config/db.js";
import {
  users,
  freelancer_profiles,
  recruiter_profiles,
  saved_freelancers,
} from "../shared/schema.js";
import { sql } from "drizzle-orm";

const PASSWORD = "TestFMS2024!";
const HASH = await bcrypt.hash(PASSWORD, 12);

async function upsertUser(email: string, role: "recruiter" | "freelancer", firstName: string, lastName: string) {
  const existing = await db.select().from(users).where(eq(users.email, email));
  if (existing.length) {
    console.log(`  ↩  ${email} already exists (id=${existing[0].id})`);
    return existing[0];
  }
  const [user] = await db
    .insert(users)
    .values({
      email,
      password: HASH,
      role,
      first_name: firstName,
      last_name: lastName,
      email_verified: true,
    })
    .returning();
  console.log(`  ✓  Created ${role} ${email} (id=${user.id})`);
  return user;
}

console.log("\n=== FMS Test Seed ===\n");

// 1. Employer
const employer = await upsertUser("fms-employer@test.eventlink.com", "recruiter", "FMS", "Employer");

const existingRP = await db.select().from(recruiter_profiles).where(eq(recruiter_profiles.user_id, employer.id));
if (!existingRP.length) {
  await db.insert(recruiter_profiles).values({
    user_id: employer.id,
    company_name: "FMS Test Productions",
    contact_name: "FMS Employer",
    company_type: "Production company",
    location: "London, UK",
    description: "Test employer account for FMS feature testing.",
  });
  console.log(`  ✓  Recruiter profile created`);
} else {
  console.log(`  ↩  Recruiter profile already exists`);
}

// Subscription row via raw SQL (subscriptions table is in FMS1 schema, not this worktree)
await db.execute(sql`
  INSERT INTO subscriptions (employer_id, stripe_customer_id, tier, status, created_at, updated_at)
  VALUES (${employer.id}, 'cus_test_fms_seed', 'pro', 'active', now(), now())
  ON CONFLICT (employer_id) DO UPDATE SET status = 'active', tier = 'pro', updated_at = now()
`);
console.log(`  ✓  Subscription row upserted (pro/active)`);

// 2. Freelancers
const crew1 = await upsertUser("fms-crew1@test.eventlink.com", "freelancer", "Alex", "Camera");
const crew2 = await upsertUser("fms-crew2@test.eventlink.com", "freelancer", "Sam", "Sound");

for (const [crew, title, skills] of [
  [crew1, "Camera Operator", ["Camera", "Steadicam", "Live Events"]],
  [crew2, "Sound Engineer", ["Live Sound", "FOH", "RF Coordination"]],
] as const) {
  const existing = await db.select().from(freelancer_profiles).where(eq(freelancer_profiles.user_id, crew.id));
  if (!existing.length) {
    await db.insert(freelancer_profiles).values({
      user_id: crew.id,
      first_name: crew.first_name,
      last_name: crew.last_name,
      title,
      skills: [...skills],
      location: "London, UK",
      availability_status: "available",
    });
    console.log(`  ✓  Freelancer profile created for ${crew.email}`);
  } else {
    console.log(`  ↩  Freelancer profile already exists for ${crew.email}`);
  }
}

// 3. Save both freelancers to employer's crew
for (const freelancer of [crew1, crew2]) {
  const existing = await db
    .select()
    .from(saved_freelancers)
    .where(
      eq(saved_freelancers.recruiter_id, employer.id)
    );
  const alreadySaved = existing.some((r) => r.freelancer_id === freelancer.id);
  if (!alreadySaved) {
    await db.insert(saved_freelancers).values({
      recruiter_id: employer.id,
      freelancer_id: freelancer.id,
    });
    console.log(`  ✓  Saved ${freelancer.email} to employer crew`);
  } else {
    console.log(`  ↩  ${freelancer.email} already in employer crew`);
  }
}

console.log(`
=== Done ===

Login at /auth with:
  Email:    fms-employer@test.eventlink.com   (recruiter / FMS subscriber)
  Email:    fms-crew1@test.eventlink.com      (freelancer)
  Email:    fms-crew2@test.eventlink.com      (freelancer)
  Password: ${PASSWORD}  (all accounts)
`);

process.exit(0);
