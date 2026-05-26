/**
 * Dev data seeder — creates sample recruiters, teams, freelancers & jobs.
 * Run once: npx tsx server/api/utils/seed-dev-data.ts
 */

import dotenv from "dotenv";
dotenv.config();

import { db } from "../config/db";
import {
  freelancer_profiles,
  job_applications,
  recruiter_profiles,
  teamMembers,
  users,
} from "../../../shared/schema";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

const HASH = await bcrypt.hash("Password123!", 10);

async function upsertUser(email: string, role: "recruiter" | "freelancer", firstName: string, lastName: string) {
  const existing = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (existing[0]) return existing[0];
  const [u] = await db.insert(users).values({
    email,
    password: HASH,
    role,
    first_name: firstName,
    last_name: lastName,
    email_verified: true,
    status: "active",
  }).returning();
  return u;
}

// ── Recruiter companies ──────────────────────────────────────────────────────

const companies = [
  {
    email: "events@livenation-uk.dev",
    firstName: "Sarah", lastName: "Mitchell",
    company: "Live Nation UK", type: "Agency", location: "London",
    website: "https://www.livenation.co.uk",
    desc: "Leading live entertainment company producing large-scale music events and festivals across the UK.",
  },
  {
    email: "ops@aegpresents.dev",
    firstName: "James", lastName: "Robertson",
    company: "AEG Presents", type: "Agency", location: "London",
    website: "https://www.aegpresents.com",
    desc: "Global promoter and producer of live music events, including concerts, festivals, and tours.",
  },
  {
    email: "hiring@festivalrepublic.dev",
    firstName: "Emma", lastName: "Clarke",
    company: "Festival Republic", type: "Festival Organiser", location: "Manchester",
    website: "https://www.festivalrepublic.com",
    desc: "One of the UK's leading festival promoters, operating Latitude, Reading, Leeds and more.",
  },
  {
    email: "crew@eventim-apollo.dev",
    firstName: "David", lastName: "Patel",
    company: "Eventim Apollo", type: "Venue", location: "London",
    website: "https://www.eventimapollo.com",
    desc: "Iconic 5,000-capacity music venue in Hammersmith, hosting major artists year-round.",
  },
  {
    email: "staffing@showsec.dev",
    firstName: "Claire", lastName: "Nguyen",
    company: "Showsec", type: "Security & Crowd Management", location: "Leicester",
    website: "https://www.showsec.co.uk",
    desc: "UK's leading crowd management and event security company.",
  },
];

// Team members (sub-accounts for some companies)
const teamMemberDefs = [
  // Live Nation team members
  { companyEmail: "events@livenation-uk.dev", email: "tom.baker@livenation-uk.dev", firstName: "Tom", lastName: "Baker", role: "manager" as const, accepted: true },
  { companyEmail: "events@livenation-uk.dev", email: "lucy.chen@livenation-uk.dev", firstName: "Lucy", lastName: "Chen", role: "manager" as const, accepted: true },
  { companyEmail: "events@livenation-uk.dev", email: "invited.pending@livenation-uk.dev", firstName: "Pending", lastName: "Invite", role: "manager" as const, accepted: false },

  // AEG team members
  { companyEmail: "ops@aegpresents.dev", email: "rachel.woods@aegpresents.dev", firstName: "Rachel", lastName: "Woods", role: "admin" as const, accepted: true },
  { companyEmail: "ops@aegpresents.dev", email: "mike.jones@aegpresents.dev", firstName: "Mike", lastName: "Jones", role: "manager" as const, accepted: true },

  // Festival Republic — one member
  { companyEmail: "hiring@festivalrepublic.dev", email: "anna.smith@festivalrepublic.dev", firstName: "Anna", lastName: "Smith", role: "manager" as const, accepted: true },
];

// ── Freelancers ──────────────────────────────────────────────────────────────

const freelancers = [
  {
    email: "alex.turner@freelance.dev", firstName: "Alex", lastName: "Turner",
    title: "Stage Manager", location: "London",
    skills: ["Stage Management", "Event Production", "Crew Coordination", "Health & Safety"],
    bio: "Experienced stage manager with 8+ years in live music events, festivals and theatre productions across the UK.",
    availability: "available" as const,
  },
  {
    email: "priya.shah@freelance.dev", firstName: "Priya", lastName: "Shah",
    title: "Sound Engineer", location: "Manchester",
    skills: ["FOH Mixing", "Monitor Engineering", "DiGiCo", "Avid S6L", "Line Arrays"],
    bio: "FOH and monitor engineer with extensive festival experience. Credits include Reading, Glastonbury, and multiple arena tours.",
    availability: "available" as const,
  },
  {
    email: "ben.harris@freelance.dev", firstName: "Ben", lastName: "Harris",
    title: "Lighting Designer", location: "Bristol",
    skills: ["Lighting Design", "grandMA3", "Avolites", "Robe Fixtures", "Festival Lighting"],
    bio: "Creative lighting designer specialising in large-scale outdoor festivals and arena concerts.",
    availability: "busy" as const,
  },
  {
    email: "sophie.wright@freelance.dev", firstName: "Sophie", lastName: "Wright",
    title: "Event Coordinator", location: "Birmingham",
    skills: ["Event Planning", "Vendor Management", "Budget Control", "Artist Liaison", "Logistics"],
    bio: "Detail-oriented event coordinator with experience across music, corporate and charity sectors.",
    availability: "available" as const,
  },
  {
    email: "dan.okafor@freelance.dev", firstName: "Dan", lastName: "Okafor",
    title: "Video Operator (vMix)", location: "London",
    skills: ["vMix", "Live Streaming", "IMAG", "Ross Video", "Blackmagic"],
    bio: "Specialist live video operator with credits on BBC broadcasts, major festival streams and hybrid events.",
    availability: "available" as const,
  },
  {
    email: "maya.patel@freelance.dev", firstName: "Maya", lastName: "Patel",
    title: "Production Manager", location: "Glasgow",
    skills: ["Production Management", "Budget Planning", "Site Management", "Health & Safety", "Logistics"],
    bio: "Seasoned production manager with 12 years leading large-scale outdoor events and stadium shows.",
    availability: "unavailable" as const,
  },
  {
    email: "jack.morrison@freelance.dev", firstName: "Jack", lastName: "Morrison",
    title: "Rigger", location: "Leeds",
    skills: ["Rigging", "IRATA", "Arena Rigging", "Roof Systems", "Load Calculations"],
    bio: "IRATA certified rigger specialising in concert touring and arena productions.",
    availability: "available" as const,
  },
  {
    email: "lisa.fernandez@freelance.dev", firstName: "Lisa", lastName: "Fernandez",
    title: "Crowd Safety Manager", location: "London",
    skills: ["Crowd Safety", "Risk Assessment", "Evacuation Planning", "Event Security", "NVQ Level 4"],
    bio: "Licensed crowd safety manager with extensive experience at UK's largest festivals and sporting events.",
    availability: "available" as const,
  },
];

// ── Jobs ─────────────────────────────────────────────────────────────────────

// status values: 'active' = posted/public, 'paused' = posted but paused, 'private' = not visible, 'closed' = filled
const jobDefs = [
  {
    companyEmail: "events@livenation-uk.dev",
    title: "FOH Sound Engineer — Summer Tour", company: "Live Nation UK", location: "London",
    type: "freelance" as const, rate: "£450/day", status: "active" as const,
    desc: "Seeking an experienced FOH sound engineer for a 6-week UK summer arena tour. Must have experience with DiGiCo SD range.",
    event_date: "2026-07-01", end_date: "2026-08-15",
  },
  {
    companyEmail: "events@livenation-uk.dev",
    title: "Stage Manager — Festival Season", company: "Live Nation UK", location: "Various UK",
    type: "freelance" as const, rate: "£350/day", status: "active" as const,
    desc: "Experienced stage managers needed across our summer festival portfolio. Multiple positions available.",
    event_date: "2026-06-01",
  },
  {
    companyEmail: "tom.baker@livenation-uk.dev",
    title: "Runner / Stage Hand", company: "Live Nation UK", location: "O2 Arena, London",
    type: "temporary" as const, rate: "£150/day", status: "active" as const,
    desc: "General stage hands and runners required for production load-in at the O2. 3-day call.",
    event_date: "2026-06-10", end_date: "2026-06-12",
  },
  {
    companyEmail: "ops@aegpresents.dev",
    title: "Production Manager — Hyde Park Series", company: "AEG Presents", location: "Hyde Park, London",
    type: "contract" as const, rate: "£600/day", status: "active" as const,
    desc: "Senior production manager required for BST Hyde Park 2026. 8-week contract covering full production period.",
    event_date: "2026-07-05", end_date: "2026-07-13",
  },
  {
    companyEmail: "ops@aegpresents.dev",
    title: "Lighting Designer", company: "AEG Presents", location: "The O2, London",
    type: "freelance" as const, rate: "£500/day", status: "private" as const,
    desc: "Creative LD sought for a major pop arena tour. grandMA3 essential.",
    event_date: "2026-09-01",
  },
  {
    companyEmail: "hiring@festivalrepublic.dev",
    title: "Site Safety Manager — Reading Festival", company: "Festival Republic", location: "Reading",
    type: "freelance" as const, rate: "£400/day", status: "active" as const,
    desc: "Experienced site safety manager required for Reading Festival 2026. NEBOSH essential.",
    event_date: "2026-08-21", end_date: "2026-08-25",
  },
  {
    companyEmail: "hiring@festivalrepublic.dev",
    title: "Crowd Safety Coordinator", company: "Festival Republic", location: "Leeds",
    type: "freelance" as const, rate: "£350/day", status: "closed" as const,
    desc: "Crowd safety coordinator for Leeds Festival. Position now filled.",
    event_date: "2026-08-21",
  },
  {
    companyEmail: "crew@eventim-apollo.dev",
    title: "Venue Technical Manager", company: "Eventim Apollo", location: "Hammersmith, London",
    type: "full-time" as const, rate: "£45,000/year", status: "active" as const,
    desc: "Permanent venue technical manager position overseeing all technical aspects of the Apollo.",
  },
  {
    companyEmail: "staffing@showsec.dev",
    title: "Senior Crowd Manager", company: "Showsec", location: "Multiple UK Venues",
    type: "freelance" as const, rate: "£280/day", status: "active" as const,
    desc: "Senior crowd managers required across our venue portfolio throughout summer. NVQ Level 4 Spectator Safety essential.",
    event_date: "2026-06-01", end_date: "2026-09-30",
  },
];

// ─────────────────────────────────────────────────────────────────────────────

console.log("🌱 Seeding dev data...\n");

// Create company owner accounts
const companyUsers: Record<string, typeof users.$inferSelect> = {};
for (const c of companies) {
  const u = await upsertUser(c.email, "recruiter", c.firstName, c.lastName);
  companyUsers[c.email] = u;

  // Recruiter profile
  const existing = await db.select().from(recruiter_profiles).where(eq(recruiter_profiles.user_id, u.id)).limit(1);
  if (!existing[0]) {
    await db.insert(recruiter_profiles).values({
      user_id: u.id,
      company_name: c.company,
      contact_name: `${c.firstName} ${c.lastName}`,
      company_type: c.type,
      location: c.location,
      website_url: c.website,
      description: c.desc,
    });
  }
  console.log(`  ✅ Recruiter: ${c.email} (${c.company})`);
}

// Create team member accounts
for (const m of teamMemberDefs) {
  const companyOwner = companyUsers[m.companyEmail];
  if (!companyOwner) continue;

  let memberUser = m.accepted
    ? await upsertUser(m.email, "recruiter", m.firstName, m.lastName)
    : null;

  // Check if team_member row already exists
  const existingRow = await db
    .select()
    .from(teamMembers)
    .where(eq(teamMembers.invitedEmail, m.email))
    .limit(1);

  if (!existingRow[0]) {
    await db.insert(teamMembers).values({
      companyId: companyOwner.id,
      userId: memberUser?.id ?? null,
      role: m.role,
      invitedEmail: m.email,
      inviteToken: m.accepted ? null : `tok_${Math.random().toString(36).slice(2)}`,
      inviteAccepted: m.accepted,
      inviteAcceptedAt: m.accepted ? new Date() : null,
    });
  }
  console.log(`  👥 Team member: ${m.email} → ${m.companyEmail} (${m.accepted ? "accepted" : "pending"})`);
}

// Create freelancer accounts
const freelancerUsers: Array<typeof users.$inferSelect> = [];
for (const f of freelancers) {
  const u = await upsertUser(f.email, "freelancer", f.firstName, f.lastName);
  freelancerUsers.push(u);

  const existing = await db.select().from(freelancer_profiles).where(eq(freelancer_profiles.user_id, u.id)).limit(1);
  if (!existing[0]) {
    await db.insert(freelancer_profiles).values({
      user_id: u.id,
      first_name: f.firstName,
      last_name: f.lastName,
      title: f.title,
      location: f.location,
      skills: f.skills,
      bio: f.bio,
      availability_status: f.availability,
      experience_years: Math.floor(Math.random() * 10) + 3,
    });
  }
  console.log(`  🎤 Freelancer: ${f.email} (${f.title})`);
}

// Collect all recruiter user IDs (owners + accepted members)
const allRecruiterEmails = [
  ...companies.map((c) => c.email),
  ...teamMemberDefs.filter((m) => m.accepted).map((m) => m.email),
];
const recruiterUserMap: Record<string, number> = {};
for (const email of allRecruiterEmails) {
  const u = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (u[0]) recruiterUserMap[email] = u[0].id;
}

// Create jobs (use raw SQL to avoid posted_by_user_id schema drift)
const createdJobIds: number[] = [];
for (const j of jobDefs) {
  const recruiterId = recruiterUserMap[j.companyEmail];
  if (!recruiterId) continue;

  const existingJob = await db.execute(
    sql`SELECT id FROM jobs WHERE title = ${j.title} LIMIT 1`
  );
  if (existingJob.length > 0) {
    createdJobIds.push((existingJob[0] as any).id as number);
    continue;
  }

  const inserted = await db.execute(sql`
    INSERT INTO jobs (recruiter_id, title, company, location, type, rate, description, status, event_date, end_date, created_at, updated_at)
    VALUES (
      ${recruiterId}, ${j.title}, ${j.company}, ${j.location}, ${j.type},
      ${j.rate}, ${j.desc}, ${j.status},
      ${j.event_date ?? null}, ${j.end_date ?? null},
      NOW(), NOW()
    )
    RETURNING id
  `);
  if (inserted[0]) createdJobIds.push((inserted[0] as any).id as number);
  console.log(`  💼 Job: ${j.title}`);
}

// Create a handful of applications from freelancers to active jobs
const activeJobIds = createdJobIds.slice(0, 5);
let appCount = 0;
for (const jobId of activeJobIds) {
  const applicants = freelancerUsers.slice(0, 4);
  for (const freelancer of applicants) {
    const existing = await db.execute(
      sql`SELECT id FROM job_applications WHERE job_id = ${jobId} AND freelancer_id = ${freelancer.id} LIMIT 1`
    );
    if (existing.length > 0) continue;

    const statuses = ["applied", "reviewed", "shortlisted", "hired"];
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    const coverLetter = `Hi, I am very interested in this opportunity and would love to discuss further.`;

    await db.execute(sql`
      INSERT INTO job_applications (job_id, freelancer_id, status, cover_letter, applied_at, updated_at)
      VALUES (${jobId}, ${freelancer.id}, ${status}, ${coverLetter}, NOW(), NOW())
    `);
    appCount++;
  }
}

console.log(`  📋 Applications: ${appCount} created\n`);
console.log("✅ Dev data seeded successfully!\n");
console.log("Sample accounts (all password: Password123!):");
console.log("  Recruiters (company owners):");
companies.forEach((c) => console.log(`    ${c.email}  →  ${c.company}`));
console.log("  Team members:");
teamMemberDefs.filter((m) => m.accepted).forEach((m) => console.log(`    ${m.email}`));
console.log("  Freelancers:");
freelancers.forEach((f) => console.log(`    ${f.email}  →  ${f.title}`));

process.exit(0);
