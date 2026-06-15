/**
 * Development seed script — realistic UK events industry data
 * Run: npx tsx server/seed-dev.ts
 *
 * Creates:
 *   - 3 recruiter companies (AV, Broadcast, Live Events)
 *   - 12 freelancers across all common crew roles
 *   - 24 past/current/future jobs
 *   - Applications, bookings (all statuses), briefs, ratings, messages
 *   - Quotes and invoices with full history
 *   - Saved freelancers, availability enquiries
 *
 * All users share password: Password123!
 * Main test recruiter: sarah@apexav.co.uk
 * Main test freelancer: james@gmail.com
 */

import dotenv from "dotenv";
dotenv.config();

import bcrypt from "bcrypt";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../shared/schema";
import { eq } from "drizzle-orm";

const client = postgres(process.env.DATABASE_URL!, { prepare: false });
const db = drizzle(client, { schema });

// ── Helpers ─────────────────────────────────────────────────────────────────

const hash = (pw: string) => bcrypt.hash(pw, 10);

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

function daysFromNow(n: number): string {
  const d = new Date(Date.now() + n * 24 * 60 * 60 * 1000);
  return d.toISOString().split("T")[0];
}

function pastDate(n: number): string {
  return daysAgo(n).toISOString().split("T")[0];
}

const PASS = await hash("Password123!");

// ── 1. USERS ─────────────────────────────────────────────────────────────────

console.log("Creating users…");

// Recruiters
const [r1] = await db.insert(schema.users).values({
  email: "sarah@apexav.co.uk",
  password: PASS,
  role: "recruiter",
  first_name: "Sarah",
  last_name: "Mitchell",
  email_verified: true,
  status: "active",
}).returning();

const [r2] = await db.insert(schema.users).values({
  email: "tom@northernlights.tv",
  password: PASS,
  role: "recruiter",
  first_name: "Tom",
  last_name: "Hargreaves",
  email_verified: true,
  status: "active",
}).returning();

const [r3] = await db.insert(schema.users).values({
  email: "claire@peaklive.com",
  password: PASS,
  role: "recruiter",
  first_name: "Claire",
  last_name: "Okafor",
  email_verified: true,
  status: "active",
}).returning();

// Freelancers
const freelancerData = [
  { email: "james.harris@gmail.com",    first: "James",   last: "Harris",    title: "FOH Sound Engineer",           skills: ["Midas M32","DiGiCo SD9","Allen & Heath","PA systems","Stage plot reading"], location: "Manchester", rate: "£350/day", yrs: 8  },
  { email: "priya.nair@gmail.com",      first: "Priya",   last: "Nair",      title: "Lighting Programmer",          skills: ["grandMA3","Hog4","ETC Eos","WYSIWYG","Pixel mapping"],                      location: "London",     rate: "£400/day", yrs: 6  },
  { email: "ben.watts@hotmail.co.uk",   first: "Ben",     last: "Watts",     title: "Video Technician",             skills: ["Resolume","Disguise","Watchout","LED processing","Ross"],                   location: "Birmingham", rate: "£300/day", yrs: 5  },
  { email: "aisha.osei@gmail.com",      first: "Aisha",   last: "Osei",      title: "Broadcast Camera Operator",    skills: ["Sony PXW-Z750","Canon C300","ENG","Studio camera","OB"],                  location: "London",     rate: "£450/day", yrs: 10 },
  { email: "luke.jenkins@gmail.com",    first: "Luke",    last: "Jenkins",   title: "Rigger",                       skills: ["IRATA L2","LOLER","Chain hoists","Structural rigging","Motors"],            location: "Leeds",      rate: "£280/day", yrs: 7  },
  { email: "chloe.barnes@icloud.com",   first: "Chloe",  last: "Barnes",    title: "Stage Manager",                skills: ["Cue sheets","Radio comms","Health & Safety","Artist liaison","Run-of-show"], location: "London",     rate: "£320/day", yrs: 9  },
  { email: "dan.moran@gmail.com",       first: "Dan",     last: "Moran",     title: "AV Technician",                skills: ["Extron","Crestron","Barco","Christie","Laser projectors"],                  location: "Bristol",    rate: "£260/day", yrs: 4  },
  { email: "nina.walsh@gmail.com",      first: "Nina",    last: "Walsh",     title: "Monitor Engineer",             skills: ["DiGiCo SD5","Waves plugins","In-ear monitoring","RF management","Shure"],    location: "Manchester", rate: "£380/day", yrs: 7  },
  { email: "oliver.stead@gmail.com",    first: "Oliver",  last: "Stead",     title: "Production Manager",           skills: ["Budget management","CAD","Scheduling","Crew management","H&S"],             location: "London",     rate: "£600/day", yrs: 15 },
  { email: "fatima.ali@yahoo.co.uk",    first: "Fatima",  last: "Ali",       title: "Event Producer",               skills: ["Concept development","Vendor management","Logistics","Run-of-show","PRINCE2"], location: "Birmingham", rate: "£500/day", yrs: 11 },
  { email: "ryan.cooper@gmail.com",     first: "Ryan",    last: "Cooper",    title: "Broadcast Vision Mixer",       skills: ["Sony XVS","Grass Valley Kayenne","EVS","Chyron","ATEM"],                    location: "London",     rate: "£480/day", yrs: 8  },
  { email: "sian.hughes@gmail.com",     first: "Siân",    last: "Hughes",    title: "Wardrobe Technician",          skills: ["Costume maintenance","Quick-change","Alterations","Period costume","Rentals"], location: "Cardiff",    rate: "£220/day", yrs: 3  },
];

const freeUsers: (typeof schema.users.$inferSelect)[] = [];
for (const fd of freelancerData) {
  const [u] = await db.insert(schema.users).values({
    email: fd.email,
    password: PASS,
    role: "freelancer",
    first_name: fd.first,
    last_name: fd.last,
    email_verified: true,
    status: "active",
  }).returning();
  freeUsers.push(u);
}

console.log(`Created ${freeUsers.length} freelancers, 3 recruiters.`);

// ── 2. RECRUITER PROFILES ────────────────────────────────────────────────────

console.log("Creating recruiter profiles…");

await db.insert(schema.recruiter_profiles).values({
  user_id: r1.id,
  company_name: "Apex AV Solutions",
  contact_name: "Sarah Mitchell",
  company_type: "Production Company",
  company_size: "6-20",
  founded_year: 2011,
  company_registration_number: "08234567",
  vat_number: "GB123456789",
  description: "Full-service AV production company specialising in corporate events, conferences, and awards ceremonies across the UK.",
  mission_statement: "Delivering world-class audio-visual experiences with unmatched crew quality and reliability.",
  notable_clients: "KPMG, Barclays, NHS England, Sky, ITV",
  location: "Manchester",
  address_line1: "14 Media City Way",
  city: "Salford",
  county: "Greater Manchester",
  postcode: "M50 2AB",
  phone: "0161 234 5678",
  website_url: "https://apexav.co.uk",
  specialisations: ["Corporate AV","Conferences","Awards Ceremonies","Hybrid Events","LED Walls"],
  typical_roles: ["FOH Engineer","Lighting Operator","Video Technician","Stage Manager","AV Technician"],
  day_rate_min: 25000,
  day_rate_max: 60000,
  payment_terms: "30 days",
  ir35_preference: "outside",
  public_liability_value: "£10m",
  employers_liability: true,
  professional_indemnity: true,
  gdpr_compliant: true,
  industry_bodies: ["PLASA","ABTT","PSA"],
});

await db.insert(schema.recruiter_profiles).values({
  user_id: r2.id,
  company_name: "Northern Lights Television",
  contact_name: "Tom Hargreaves",
  company_type: "Broadcast Company",
  company_size: "21-50",
  founded_year: 2005,
  description: "Leading broadcast and OB production company based in Leeds, covering sport, entertainment and news.",
  location: "Leeds",
  address_line1: "Dock Street Studios",
  city: "Leeds",
  county: "West Yorkshire",
  postcode: "LS10 1LJ",
  phone: "0113 345 6789",
  website_url: "https://northernlights.tv",
  specialisations: ["Broadcast","OB","Sport","Live TV","News"],
  typical_roles: ["Camera Operator","Vision Mixer","Broadcast Engineer","EVS Operator","Director"],
  day_rate_min: 35000,
  day_rate_max: 80000,
  payment_terms: "45 days",
  ir35_preference: "both",
  public_liability_value: "£10m",
  employers_liability: true,
  professional_indemnity: true,
  gdpr_compliant: true,
  industry_bodies: ["RTS","BECTU"],
});

await db.insert(schema.recruiter_profiles).values({
  user_id: r3.id,
  company_name: "Peak Live Events",
  contact_name: "Claire Okafor",
  company_type: "Event Production Company",
  company_size: "6-20",
  founded_year: 2016,
  description: "Creative live event production for brand experiences, festivals, and touring shows.",
  location: "London",
  address_line1: "27 Bermondsey Street",
  city: "London",
  county: "Greater London",
  postcode: "SE1 3XF",
  phone: "020 7123 4567",
  website_url: "https://peaklive.com",
  specialisations: ["Live Events","Brand Experiences","Festivals","Touring","Outdoor Events"],
  typical_roles: ["Stage Manager","Production Manager","Rigger","Monitor Engineer","Stage Tech"],
  day_rate_min: 20000,
  day_rate_max: 65000,
  payment_terms: "30 days",
  ir35_preference: "outside",
  public_liability_value: "£5m",
  employers_liability: true,
  professional_indemnity: false,
  gdpr_compliant: true,
  industry_bodies: ["PLASA","AIF"],
});

// ── 3. FREELANCER PROFILES ───────────────────────────────────────────────────

console.log("Creating freelancer profiles…");

const profileData = [
  {
    superpower: "Midas PRO + M32 specialist",
    bio: "Eight years as a touring and corporate FOH engineer. Comfortable on any desk, from small conference rooms to 5,000-cap arenas. Based in Manchester but happy to travel.",
    availability_status: "available" as const,
    ir35_status: "outside",
    certifications: ["First Aid at Work","Manual Handling","Working at Height"],
    work_history: [
      { jobTitle: "FOH Engineer", company: "SFL Group", dates: "2020-2023", details: "Corporate touring" },
      { jobTitle: "Sound Tech", company: "SSE Rig", dates: "2017-2020", details: "Festival & live" },
    ],
  },
  {
    superpower: "grandMA3 certified programmer",
    bio: "Lighting programmer with a eye for detail. Specialise in corporate, theatre, and large-scale awards. grandMA3 certified, experienced with visualisation and pre-production.",
    availability_status: "available" as const,
    certifications: ["grandMA3 Certified","ABTT Theatre Safety"],
    work_history: [
      { jobTitle: "Lighting Programmer", company: "HSL Group", dates: "2019-present", details: "Touring & corporate" },
    ],
  },
  {
    superpower: "Resolume real-time VJ & content",
    bio: "Video tech with a passion for content and real-time visuals. Experienced in LED processing, disguise, and Resolume. Comfortable with large-format installations.",
    availability_status: "available" as const,
    certifications: ["disguise Certified Operator"],
    work_history: [
      { jobTitle: "Video Technician", company: "XL Video", dates: "2019-2023", details: "Corporate & live" },
    ],
  },
  {
    superpower: "10 years ENG & studio camera",
    bio: "Seasoned broadcast camera operator with experience across ENG, OB, and studio environments. Worked with BBC, ITV, Sky and numerous indie broadcasters.",
    availability_status: "available" as const,
    certifications: ["Sony Certified Operator","NCTJ"],
    work_history: [
      { jobTitle: "Camera Operator", company: "BBC Sport", dates: "2015-2019", details: "Sport & entertainment" },
      { jobTitle: "Freelance", company: "Various", dates: "2019-present", details: "Multi-platform" },
    ],
  },
  {
    superpower: "IRATA Level 2 theatrical rigger",
    bio: "Rigger with expertise in theatrical, concert, and corporate rigging. Fully certified, strong on structural calculation and motor operation. Happy with indoor and outdoor structures.",
    availability_status: "available" as const,
    certifications: ["IRATA Level 2","IPAF 1b/3b","First Aid","Working at Height"],
    work_history: [
      { jobTitle: "Head Rigger", company: "Brilliant Stages", dates: "2018-2022", details: "Touring rigs" },
      { jobTitle: "Rigger", company: "TAIT Towers", dates: "2016-2018", details: "Stadium shows" },
    ],
  },
  {
    superpower: "Artist liaison & radio comms expert",
    bio: "Experienced stage manager comfortable running large-format shows, corporate conferences, and arena events. Calm under pressure, excellent at artist liaison and crew coordination.",
    availability_status: "available" as const,
    certifications: ["IOSH Managing Safely","First Aid"],
    work_history: [
      { jobTitle: "Stage Manager", company: "Shubert Organisation", dates: "2018-2023", details: "Theatre & corporate" },
    ],
  },
  {
    superpower: "Crestron & Extron certified integrator",
    bio: "Corporate AV technician with four years in conference and hotel AV. Comfortable with integration, control systems, and on-site support for multi-room events.",
    availability_status: "available" as const,
    certifications: ["Crestron CTS","Extron AV Associate"],
    work_history: [
      { jobTitle: "AV Technician", company: "Kinly", dates: "2020-2024", details: "Corporate AV" },
    ],
  },
  {
    superpower: "RF & in-ear monitoring specialist",
    bio: "Monitor engineer specialising in complex RF environments and touring IEM systems. DiGiCo-first, strong on Sennheiser and Shure RF. Comfortable from club shows to stadium.",
    availability_status: "busy" as const,
    certifications: ["Shure RF Certified"],
    work_history: [
      { jobTitle: "Monitor Engineer", company: "Britannia Row", dates: "2017-2022", details: "Arena & stadium touring" },
    ],
  },
  {
    superpower: "Large-scale event PM & budget control",
    bio: "Production manager with 15 years across live entertainment, corporate events, and brand activations. Expert in budget control, crew management, and supplier relationships.",
    availability_status: "available" as const,
    certifications: ["PRINCE2","IOSH","First Aid"],
    work_history: [
      { jobTitle: "Head of Production", company: "George P. Johnson", dates: "2015-2022", details: "Brand experiences" },
      { jobTitle: "Production Manager", company: "Live Nation", dates: "2010-2015", details: "Arena & stadium" },
    ],
  },
  {
    superpower: "End-to-end event concepting & delivery",
    bio: "Event producer with 11 years creating large-scale brand activations and corporate experiences. PRINCE2 practitioner, known for delivering complex multi-supplier events on time and on budget.",
    availability_status: "available" as const,
    certifications: ["PRINCE2 Practitioner","CEM"],
    work_history: [
      { jobTitle: "Senior Producer", company: "Jack Morton Worldwide", dates: "2016-2022", details: "Global brand events" },
    ],
  },
  {
    superpower: "Live TV vision mixing & EVS",
    bio: "Broadcast vision mixer with eight years across sport, entertainment and awards. Sony XVS and GV Kayenne experienced. Comfortable in fast-turnaround live environments.",
    availability_status: "available" as const,
    certifications: ["EVS Operator Certified"],
    work_history: [
      { jobTitle: "Vision Mixer", company: "IMG Productions", dates: "2018-present", details: "Live sport & entertainment" },
    ],
  },
  {
    superpower: "Period costume & quick-change specialist",
    bio: "Wardrobe technician with theatre and TV experience. Strong on costume maintenance, quick-changes, and period garment work. Based in Cardiff, happy to travel.",
    availability_status: "available" as const,
    certifications: ["City & Guilds Costume"],
    work_history: [
      { jobTitle: "Wardrobe Technician", company: "Sherman Theatre", dates: "2022-present", details: "Theatre & TV" },
    ],
  },
];

for (let i = 0; i < freeUsers.length; i++) {
  const u = freeUsers[i];
  const fd = freelancerData[i];
  const pd = profileData[i];
  await db.insert(schema.freelancer_profiles).values({
    user_id: u.id,
    first_name: fd.first,
    last_name: fd.last,
    title: fd.title,
    superpower: pd.superpower,
    bio: pd.bio,
    location: fd.location,
    experience_years: fd.yrs,
    skills: fd.skills,
    availability_status: pd.availability_status,
    certifications: pd.certifications,
    work_history: pd.work_history,
  });
}

// ── 4. JOBS ──────────────────────────────────────────────────────────────────

console.log("Creating jobs…");

const jobDefs = [
  // ── Past closed jobs (Apex AV / r1)
  {
    recruiter_id: r1.id, company: "Apex AV Solutions",
    title: "FOH Sound Engineer — KPMG Annual Conference", location: "Manchester", type: "freelance" as const,
    rate: "£350/day", description: "Seeking an experienced FOH engineer for a two-day corporate conference at Manchester Central. 1,200 delegates, full L-Acoustics system pre-rigged. Input list to follow.",
    event_date: pastDate(120), status: "closed" as const,
  },
  {
    recruiter_id: r1.id, company: "Apex AV Solutions",
    title: "Lighting Operator — Barclays Awards Dinner", location: "London", type: "freelance" as const,
    rate: "£400/day", description: "Lighting op required for a gala awards dinner at the Grosvenor House Hotel. grandMA3 on site. Pre-prog supplied, operator to run show.",
    event_date: pastDate(90), status: "closed" as const,
  },
  {
    recruiter_id: r1.id, company: "Apex AV Solutions",
    title: "Video Technician — NHS Conference", location: "Birmingham", type: "freelance" as const,
    rate: "£280/day", description: "AV tech required for a three-day NHS leadership conference. Barco S3 image processor, 2x seamless LED walls. Resolume playback for animations.",
    event_date: pastDate(75), status: "closed" as const,
  },
  {
    recruiter_id: r1.id, company: "Apex AV Solutions",
    title: "AV Technician — Hybrid Event Setup & Strike", location: "Manchester", type: "freelance" as const,
    rate: "£260/day", description: "Tech required for build and strike of a hybrid conference. Two days of work. Extron matrix, Barco ClickShare, two confidence monitors and main PA.",
    event_date: pastDate(60), status: "closed" as const,
  },
  {
    recruiter_id: r1.id, company: "Apex AV Solutions",
    title: "Stage Manager — Sky Tech Summit", location: "London", type: "freelance" as const,
    rate: "£320/day", description: "Stage manager needed for a two-day tech conference, 600 delegates. Keynote speakers, panel sessions, and evening networking. Full run-of-show supplied.",
    event_date: pastDate(45), status: "closed" as const,
  },
  // ── Past closed jobs (Northern Lights / r2)
  {
    recruiter_id: r2.id, company: "Northern Lights Television",
    title: "Broadcast Camera Operator — Premier League OB", location: "Leeds", type: "freelance" as const,
    rate: "£450/day", description: "EFP camera operator required for Premier League OB coverage. Sony F800 cameras. Two-day contract including match day and pre-record.",
    event_date: pastDate(100), status: "closed" as const,
  },
  {
    recruiter_id: r2.id, company: "Northern Lights Television",
    title: "Vision Mixer — Live Awards Show", location: "London", type: "freelance" as const,
    rate: "£480/day", description: "Vision mixer required for a live entertainment awards programme. Sony XVS system. Full dress rehearsal on the day prior. IMAG and TX mix.",
    event_date: pastDate(55), status: "closed" as const,
  },
  // ── Past closed jobs (Peak Live / r3)
  {
    recruiter_id: r3.id, company: "Peak Live Events",
    title: "Rigger — Festival Main Stage", location: "Bristol", type: "freelance" as const,
    rate: "£300/day", description: "Three riggers required for main stage build of a 3,000-cap festival. Four-day contract: two build, one show day, one de-rig. IRATA required.",
    event_date: pastDate(80), status: "closed" as const,
  },
  {
    recruiter_id: r3.id, company: "Peak Live Events",
    title: "Monitor Engineer — Arena Tour", location: "Manchester", type: "freelance" as const,
    rate: "£380/day", description: "Experienced monitor engineer required for a 12-date UK arena tour. DiGiCo SD5 provided. IEM-heavy show with complex RF setup.",
    event_date: pastDate(50), status: "closed" as const,
  },
  {
    recruiter_id: r3.id, company: "Peak Live Events",
    title: "Production Manager — Brand Activation (Red Bull)", location: "London", type: "freelance" as const,
    rate: "£600/day", description: "PM required for a complex five-day outdoor brand activation. Multi-discipline crew. Budget £180k. Supplier management and H&S lead.",
    event_date: pastDate(30), status: "closed" as const,
  },
  // ── Active jobs (all companies)
  {
    recruiter_id: r1.id, company: "Apex AV Solutions",
    title: "FOH Engineer — ITV Upfronts Presentation", location: "London", type: "freelance" as const,
    rate: "£380/day", description: "FOH engineer for a two-day ITV advertiser presentation at the BFI IMAX. L-Acoustics Kiva II system. Primarily speech and playback.",
    event_date: daysFromNow(14), status: "active" as const,
  },
  {
    recruiter_id: r1.id, company: "Apex AV Solutions",
    title: "Lighting Programmer — Gala Dinner & Awards", location: "Manchester", type: "freelance" as const,
    rate: "£420/day", description: "Pre-production and show day programming for a 500-pax gala dinner and awards at Edwardian Manchester. grandMA3 ultra-light + Node8.",
    event_date: daysFromNow(21), status: "active" as const,
  },
  {
    recruiter_id: r1.id, company: "Apex AV Solutions",
    title: "Stage Manager — Nationwide Conference", location: "Birmingham", type: "freelance" as const,
    rate: "£350/day", description: "Stage manager required for a full-day corporate conference at the ICC Birmingham. 400 delegates, keynote + seven breakout sessions.",
    event_date: daysFromNow(7), status: "active" as const,
  },
  {
    recruiter_id: r2.id, company: "Northern Lights Television",
    title: "Broadcast Camera Operator — ENG Package", location: "London", type: "freelance" as const,
    rate: "£450/day", description: "Camera operator needed for a two-day ENG shoot for a Netflix documentary. Sony FX9, cinema glass. Self-shooting preferred.",
    event_date: daysFromNow(10), status: "active" as const,
  },
  {
    recruiter_id: r2.id, company: "Northern Lights Television",
    title: "Vision Mixer — Live Studio Show Pilot", location: "Leeds", type: "freelance" as const,
    rate: "£500/day", description: "Vision mixer for a live studio entertainment pilot. GV Kayenne with DME. Two recording days. Full rehearsal schedule provided.",
    event_date: daysFromNow(18), status: "active" as const,
  },
  {
    recruiter_id: r3.id, company: "Peak Live Events",
    title: "Production Manager — Summer Festival (8,000 cap)", location: "Bristol", type: "freelance" as const,
    rate: "£650/day", description: "Production manager required to lead delivery of an 8,000-cap outdoor festival. Five-day contract. Multi-stage, complex logistics.",
    event_date: daysFromNow(45), status: "active" as const,
  },
  {
    recruiter_id: r3.id, company: "Peak Live Events",
    title: "Rigger — Indoor Corporate Show Build", location: "London", type: "freelance" as const,
    rate: "£290/day", description: "Rigger required for a two-day build at ExCeL London. Truss and motors for audio, lighting and video. IRATA required.",
    event_date: daysFromNow(12), status: "active" as const,
  },
  {
    recruiter_id: r3.id, company: "Peak Live Events",
    title: "Monitor Engineer — UK Club Tour (10 dates)", location: "Manchester", type: "freelance" as const,
    rate: "£350/day", description: "Monitor engineer for a 10-date club tour starting in three weeks. DiGiCo SD11 in-house at most venues. IEM and wedge show.",
    event_date: daysFromNow(22), status: "active" as const,
  },
  // ── Upcoming / future
  {
    recruiter_id: r1.id, company: "Apex AV Solutions",
    title: "AV Technician — Financial Services Summit", location: "Edinburgh", type: "freelance" as const,
    rate: "£280/day", description: "AV tech needed for a three-day summit in Edinburgh. Barco laser projectors, confidence screens, audio DSP. Build day plus three show days.",
    event_date: daysFromNow(60), status: "active" as const,
  },
  {
    recruiter_id: r2.id, company: "Northern Lights Television",
    title: "Camera Operator — Motorsport Season Opener", location: "Birmingham", type: "freelance" as const,
    rate: "£500/day", description: "Camera operator required for OB coverage of a motorsport event at Birmingham Supertrack. Sony HDC-4800 on crane.",
    event_date: daysFromNow(35), status: "active" as const,
  },
  {
    recruiter_id: r3.id, company: "Peak Live Events",
    title: "Event Producer — Brand Launch (Confidential)", location: "London", type: "freelance" as const,
    rate: "£550/day", description: "Senior producer required for a confidential consumer brand launch. Budget £250k+. High-profile talent. Complex logistics and supplier chain.",
    event_date: daysFromNow(50), status: "active" as const,
  },
  {
    recruiter_id: r1.id, company: "Apex AV Solutions",
    title: "Lighting Technician — Annual Charity Gala", location: "London", type: "freelance" as const,
    rate: "£300/day", description: "Experienced lighting tech required to operate a pre-programmed show for a charity gala at the Natural History Museum. grandMA2.",
    event_date: daysFromNow(28), status: "active" as const,
  },
  {
    recruiter_id: r1.id, company: "Apex AV Solutions",
    title: "FOH Engineer — University Freshers' Tour (20 dates)", location: "Various UK", type: "freelance" as const,
    rate: "£320/day", description: "FOH engineer for a 20-date UK university freshers' tour starting in six weeks. Funktion-One in-house at most venues. Heavy club sound.",
    event_date: daysFromNow(42), status: "active" as const,
  },
  {
    recruiter_id: r2.id, company: "Northern Lights Television",
    title: "Broadcast Engineer — Live News Studio Build", location: "Leeds", type: "freelance" as const,
    rate: "£520/day", description: "Broadcast engineer to commission a pop-up news studio for a regional election night broadcast. Calrec audio, Ross Carbonite switcher.",
    event_date: daysFromNow(30), status: "active" as const,
  },
];

const createdJobs: (typeof schema.jobs.$inferSelect)[] = [];
for (const j of jobDefs) {
  const [job] = await db.insert(schema.jobs).values({ ...j, end_date: undefined }).returning();
  createdJobs.push(job);
}

console.log(`Created ${createdJobs.length} jobs.`);

// ── 5. APPLICATIONS ───────────────────────────────────────────────────────────

console.log("Creating applications…");

// Helper: apply freelancer i to job index j with status
async function apply(fIdx: number, jIdx: number, status: string, cover?: string) {
  const [app] = await db.insert(schema.job_applications).values({
    job_id: createdJobs[jIdx].id,
    freelancer_id: freeUsers[fIdx].id,
    status: status as any,
    cover_letter: cover ?? `Hi, I'd love to help out on this one. I have all the skills and gear required. Available on the date — please get in touch.`,
  }).returning();
  return app;
}

// Past jobs — hired applications (will become bookings)
const app1  = await apply(0, 0,  "hired", "Eight years on corporate shows across the North West. Very familiar with Manchester Central. Available for the full run.");
const app2  = await apply(1, 1,  "hired", "grandMA3 programmer with corporate gala experience. Happy with the Grosvenor — beautiful room. Pre-prog looks straightforward.");
const app3  = await apply(2, 2,  "hired", "Resolume and Barco S3 are my everyday tools. Available for all three days.");
const app4  = await apply(6, 3,  "hired", "Crestron CTS certified, Extron trained. Build and strike is fine — happy to load in night before.");
const app5  = await apply(5, 4,  "hired", "Stage managed many Sky events. Comfortable with complex keynote shows and speaker management.");
const app6  = await apply(3, 5,  "hired", "OB-experienced camera op. Sony F800 — I know it well. Available both days.");
const app7  = await apply(10, 6, "hired", "XVS trained, live entertainment mixing experience. Happy to come in for the dress too.");
const app8  = await apply(4, 7,  "hired", "IRATA Level 2. Festival build is my bread and butter. Four days is fine.");
const app9  = await apply(7, 8,  "hired", "DiGiCo SD5 experienced, Shure and Sennheiser RF is my world. Available for full tour.");
const app10 = await apply(8, 9,  "hired", "PM with outdoor brand activation experience. £180k budget is very manageable — let's discuss.");

// Active jobs — mix of applied, shortlisted, rejected
const app11 = await apply(0, 10, "shortlisted", "Available. L-Acoustics Kiva II is familiar territory.");
const app12 = await apply(7, 10, "applied",     "Very experienced with speech reinforcement and small PA setups.");
const app13 = await apply(1, 11, "shortlisted", "grandMA3 ultra-light — use it regularly. Very comfortable with gala programming.");
const app14 = await apply(5, 12, "applied",     "Stage managed corporate events up to 600 pax. Available for the Birmingham ICC date.");
const app15 = await apply(3, 13, "shortlisted", "Sony FX9 and Sigma Art glass — self-shooting for Netflix is my comfort zone.");
const app16 = await apply(10, 14,"applied",     "GV Kayenne daily driver. Experienced with studio pilots.");
const app17 = await apply(8, 15, "applied",     "Festival PM with outdoor experience. 8,000 cap is my sweet spot.");
const app18 = await apply(4, 16, "shortlisted", "IRATA Level 2. ExCeL London — I've rigged there multiple times.");
const app19 = await apply(7, 17, "applied",     "Club tour monitor experience. SD11 in-house venues — easy.");
const app20 = await apply(0, 10, "rejected",    "Available for the date but less experienced with speech-focused shows.");

// Some pending applications on future jobs
await apply(9, 20,  "applied", "Senior producer with £250k+ brand launch experience. NDA is fine.");
await apply(8, 15,  "applied", "Festival PM, 8,000 cap experience — happy to discuss.");
await apply(1, 21,  "applied", "Lighting tech, grandMA2 operator. Available for the gala date.");

console.log("Applications created.");

// ── 6. BOOKINGS ───────────────────────────────────────────────────────────────

console.log("Creating bookings…");

// Helper
async function book(
  employerId: number, freelancerId: number, jobId: number | null,
  status: string, date: string, rate: string,
  callTime?: string, venue?: string, notes?: string,
  agreedBudget?: number, actualCost?: number, expenses?: number,
  roleRequired?: string, skillTags?: string[]
) {
  const [b] = await db.insert(schema.bookings).values({
    employerId,
    freelancerId,
    jobId,
    status: status as any,
    eventDate: date,
    agreedRate: rate,
    callTime: callTime ?? "08:00",
    venueAddress: venue ?? "Manchester Central, Windmill St, Manchester M2 3GX",
    employerNotes: notes ?? null,
    agreedBudget: agreedBudget ?? null,
    actualCost: actualCost ?? null,
    expenses: expenses ?? null,
    roleRequired: roleRequired ?? null,
    skillTags: skillTags ?? null,
    ir35Status: "outside",
  }).returning();
  return b;
}

// Completed bookings (Apex AV — past events)
const bk1 = await book(r1.id, freeUsers[0].id, createdJobs[0].id, "completed", pastDate(120), "£350",
  "08:00", "Manchester Central, M2 3GX", "Great show. James delivered excellently.",
  35000, 35000, 1200, "FOH Engineer", ["Midas M32","L-Acoustics","Speech reinforcement"]);

const bk2 = await book(r1.id, freeUsers[1].id, createdJobs[1].id, "completed", pastDate(90), "£400",
  "09:00", "Grosvenor House Hotel, Park Lane, London W1K 7TN", null,
  40000, 40000, 0, "Lighting Programmer", ["grandMA3","Gala show"]);

const bk3 = await book(r1.id, freeUsers[2].id, createdJobs[2].id, "completed", pastDate(75), "£280",
  "07:00", "ICC Birmingham, Broad St, Birmingham B1 2EA", null,
  28000, 28000, 800, "Video Technician", ["Barco S3","Resolume","LED wall"]);

const bk4 = await book(r1.id, freeUsers[6].id, createdJobs[3].id, "completed", pastDate(60), "£260",
  "07:30", "Manchester Central, M2 3GX", null,
  26000, 26000, 0, "AV Technician", ["Extron","Barco ClickShare"]);

const bk5 = await book(r1.id, freeUsers[5].id, createdJobs[4].id, "completed", pastDate(45), "£320",
  "07:00", "Old Trafford Conference Centre, Manchester", "Excellent stage management.",
  32000, 32000, 600, "Stage Manager", ["Run-of-show","Artist liaison","Radio comms"]);

// Completed bookings (Northern Lights)
const bk6 = await book(r2.id, freeUsers[3].id, createdJobs[5].id, "completed", pastDate(100), "£450",
  "06:00", "Elland Road, Leeds LS11 0ES", null,
  45000, 45000, 2000, "Camera Operator", ["Sony F800","EFP","OB"]);

const bk7 = await book(r2.id, freeUsers[10].id, createdJobs[6].id, "completed", pastDate(55), "£480",
  "09:00", "O2 Arena, London SE10 0DX", null,
  48000, 48000, 1500, "Vision Mixer", ["Sony XVS","Live entertainment","IMAG"]);

// Completed bookings (Peak Live)
const bk8 = await book(r3.id, freeUsers[4].id, createdJobs[7].id, "completed", pastDate(80), "£300",
  "06:00", "Ashton Court Estate, Bristol BS41 9JN", null,
  36000, 36000, 500, "Rigger", ["IRATA L2","Chain hoists","Festival"]);

const bk9 = await book(r3.id, freeUsers[7].id, createdJobs[8].id, "completed", pastDate(50), "£380",
  "07:00", "Manchester Arena, Victoria Station, Manchester M3 1AR", null,
  38000, 38000, 3000, "Monitor Engineer", ["DiGiCo SD5","IEM","Arena"]);

const bk10 = await book(r3.id, freeUsers[8].id, createdJobs[9].id, "completed", pastDate(30), "£600",
  "08:00", "Various London venues", null,
  54000, 60000, 5000, "Production Manager", ["Budget management","Outdoor","Brand activation"]);

// Confirmed bookings (upcoming — real event dates)
const bk11 = await book(r1.id, freeUsers[0].id, createdJobs[10].id, "confirmed", daysFromNow(14), "£380",
  "07:30", "BFI IMAX, South Bank, London SE1 8XT", null,
  38000, null, null, "FOH Engineer", ["L-Acoustics Kiva II","Presentation"]);

const bk12 = await book(r1.id, freeUsers[1].id, createdJobs[11].id, "confirmed", daysFromNow(21), "£420",
  "09:00", "Edwardian Manchester, Peter St, Manchester M2 5GP", null,
  42000, null, null, "Lighting Programmer", ["grandMA3","Gala dinner","Awards"]);

const bk13 = await book(r1.id, freeUsers[5].id, createdJobs[12].id, "confirmed", daysFromNow(7), "£350",
  "07:00", "ICC Birmingham, Broad St, Birmingham B1 2EA", null,
  35000, null, null, "Stage Manager", ["Corporate conference","400 delegates"]);

const bk14 = await book(r2.id, freeUsers[3].id, createdJobs[13].id, "confirmed", daysFromNow(10), "£450",
  "07:00", "Various London locations", null,
  45000, null, null, "Camera Operator", ["Sony FX9","ENG","Documentary"]);

// Briefed booking (sent brief + acknowledged)
const bk15 = await book(r3.id, freeUsers[4].id, createdJobs[16].id, "briefed", daysFromNow(12), "£290",
  "06:30", "ExCeL London, Royal Victoria Dock, London E16 1XL", null,
  29000, null, null, "Rigger", ["IRATA L2","Truss","Motors"]);

// Cancelled booking example
const bk16 = await book(r3.id, freeUsers[7].id, null, "cancelled", pastDate(20), "£350",
  "08:00", "O2 Ritz, Manchester", null,
  35000, null, null, "Monitor Engineer", ["DiGiCo SD11"]);

await db.update(schema.bookings).set({
  cancellationReason: "Event postponed by client",
  cancelledBy: "employer",
}).where(eq(schema.bookings.id, bk16.id));

// Enquired bookings (not yet confirmed)
const bk17 = await book(r1.id, freeUsers[2].id, null, "enquired", daysFromNow(28), "£280",
  "08:00", "TBC", null, null, null, null, "Video Technician", ["Resolume","LED"]);

const bk18 = await book(r2.id, freeUsers[10].id, null, "enquired", daysFromNow(18), "£500",
  "09:00", "Yorkshire TV Studios, Leeds", null, null, null, null, "Vision Mixer", ["GV Kayenne"]);

console.log("Bookings created.");

// ── 7. BRIEFS ─────────────────────────────────────────────────────────────────

console.log("Creating briefs…");

await db.insert(schema.briefs).values({
  bookingId: bk15.id,
  employerId: r3.id,
  freelancerId: freeUsers[4].id,
  eventTitle: "Indoor Corporate Show Build — ExCeL London",
  eventDate: daysFromNow(12),
  callTime: "06:30",
  venueAddress: "ExCeL London, Royal Victoria Dock, London E16 1XL",
  roleRequired: "Rigger",
  agreedRate: "£290/day",
  details: "Two-day build. Day 1: main truss grid assembly and motor fly. Day 2: trim heights and final dress. LOLER checks on all motors required before each day.",
  dresscode: "Black rigger wear. Steel-toed boots mandatory.",
  parkingInfo: "Contractor parking via Gate 3 on Western Gateway. Pass will be left with venue security.",
  contactOnDay: "Pete Dawson (Peak Live PM) — 07700 900123",
  scheduleNotes: "Day 1: Venue access 06:30. Scaffold crew in from 07:00. Loading dock B. Day 2: Access 06:00. Trim by 14:00.",
  token: "test-brief-token-bk15-001",
  status: "acknowledged",
  acknowledgedAt: daysAgo(3),
  acknowledgementNote: "All understood. See you Monday. I'll bring my IRATA card and IPAF.",
});

// Brief sent but not yet acknowledged (for confirmed booking)
await db.insert(schema.briefs).values({
  bookingId: bk13.id,
  employerId: r1.id,
  freelancerId: freeUsers[5].id,
  eventTitle: "Nationwide Conference — ICC Birmingham",
  eventDate: daysFromNow(7),
  callTime: "07:00",
  venueAddress: "ICC Birmingham, Broad St, Birmingham B1 2EA",
  roleRequired: "Stage Manager",
  agreedRate: "£350/day",
  details: "Full-day corporate conference. 400 delegates. One main stage keynote room + 7 breakout sessions. Run-of-show document attached.",
  dresscode: "Smart black — no jeans.",
  parkingInfo: "Apex account parking at NCP on Broad Street. Voucher will be emailed.",
  contactOnDay: "Sarah Mitchell (Apex) — 07700 900456",
  scheduleNotes: "Load in from 07:00. Tech rehearsal 09:00–11:00. Doors 11:30. First keynote 12:00.",
  token: "test-brief-token-bk13-001",
  status: "sent",
});

console.log("Briefs created.");

// ── 8. RATINGS ────────────────────────────────────────────────────────────────

console.log("Creating ratings…");

const ratingsData = [
  { rId: r1.id, fId: freeUsers[0].id, appId: app1.id, rating: 5, review: "James is the complete package — great ears, calm under pressure and professional from load-in to pack-out. We'll definitely be booking him again." },
  { rId: r1.id, fId: freeUsers[1].id, appId: app2.id, rating: 5, review: "Priya delivered a stunning lighting design for our gala. Pre-production was thorough and the show itself was flawless. Highly recommended." },
  { rId: r1.id, fId: freeUsers[2].id, appId: app3.id, rating: 4, review: "Ben handled the LED wall brilliantly. Minor comms issue early on but resolved quickly. Would use again." },
  { rId: r1.id, fId: freeUsers[6].id, appId: app4.id, rating: 5, review: "Dan was incredibly efficient on the hybrid setup. Solved a last-minute issue with the Crestron matrix without needing escalation. Top tech." },
  { rId: r1.id, fId: freeUsers[5].id, appId: app5.id, rating: 5, review: "Chloe ran the show like clockwork. Speakers were prepped, cues were clean, and the delegate experience was perfect." },
  { rId: r2.id, fId: freeUsers[3].id, appId: app6.id, rating: 5, review: "Aisha delivered stunning footage for the OB. Her work on the steadicam shots was exceptional. We'd book her for every Premier League match." },
  { rId: r2.id, fId: freeUsers[10].id, appId: app7.id, rating: 4, review: "Ryan mixed a clean and dynamic show. One dropped key early on, but he recovered fast and the rest of the broadcast was excellent." },
  { rId: r3.id, fId: freeUsers[4].id, appId: app8.id, rating: 5, review: "Luke was exceptional on the festival rig. Safety-first attitude, quick to work, and great with the younger crew members around him." },
  { rId: r3.id, fId: freeUsers[7].id, appId: app9.id, rating: 5, review: "Nina is the best monitor engineer we've worked with. The artist had zero complaints — the IEM mixes were perfect from the first soundcheck." },
  { rId: r3.id, fId: freeUsers[8].id, appId: app10.id, rating: 4, review: "Oliver delivered the Red Bull activation on time and on budget despite the challenges. Would benefit from more proactive client communication but technically superb." },
];

for (const r of ratingsData) {
  await db.insert(schema.ratings).values({
    job_application_id: r.appId.id,
    recruiter_id: r.rId,
    freelancer_id: r.fId,
    rating: r.rating as 1|2|3|4|5,
    review: r.review,
    status: "active",
  });
}

console.log("Ratings created.");

// ── 9. CONVERSATIONS & MESSAGES ───────────────────────────────────────────────

console.log("Creating conversations and messages…");

async function startConversation(p1: number, p2: number, messages: { sender: number; content: string }[]) {
  const [conv] = await db.insert(schema.conversations).values({
    participant_one_id: Math.min(p1, p2),
    participant_two_id: Math.max(p1, p2),
  }).returning();
  for (const m of messages) {
    await db.insert(schema.messages).values({
      conversation_id: conv.id,
      sender_id: m.sender,
      content: m.content,
      is_read: true,
    });
  }
  return conv;
}

await startConversation(r1.id, freeUsers[0].id, [
  { sender: r1.id, content: "Hi James, brilliant work on the KPMG conference last month — the client was very happy. We've got the ITV Upfronts coming up in two weeks at BFI IMAX. Would you be available? It's L-Acoustics Kiva II, mainly speech and playback." },
  { sender: freeUsers[0].id, content: "Hi Sarah, great to hear! The KPMG went really smoothly. Yes, I'm free for the ITV date. I've done a couple of shows at the IMAX before — lovely room. Happy to take it on." },
  { sender: r1.id, content: "Perfect. I'll get a booking request sent over today. Rate is £380. Let me know if you have any questions about the brief." },
  { sender: freeUsers[0].id, content: "Sounds good. I'll keep an eye out for the booking. Is there a multi-track recording requirement or purely front of house mix?" },
  { sender: r1.id, content: "Front of house only but the client may want a stereo stem for their post-event highlights reel. I'll confirm before the day." },
]);

await startConversation(r1.id, freeUsers[1].id, [
  { sender: r1.id, content: "Hi Priya, the Barclays awards feedback came back this morning — they loved the lighting. One of the clients specifically called out 'the dramatic moment before the headline act' which was your idea. Brilliant work." },
  { sender: freeUsers[1].id, content: "Oh that's so good to hear! I was hoping that reveal moment would land well. It's always a risk with conservative clients. Thanks for letting me know, Sarah." },
  { sender: r1.id, content: "We've got the Manchester gala coming up — 500 pax at the Edwardian. grandMA3 ultra-light + Node8 this time. Would you be free for pre-production and show day?" },
  { sender: freeUsers[1].id, content: "Yes absolutely. When's the pre-pro session? I'd ideally want at least a day on the desk before show day to do the dimmer curve work and check all the movers." },
]);

await startConversation(r3.id, freeUsers[4].id, [
  { sender: freeUsers[4].id, content: "Hi Claire, just to confirm I've received the brief for the ExCeL build. All looks clear. I'll be there at 06:30 on Monday. Do I need to bring anything specific for the LOLER paperwork or will that be on site?" },
  { sender: r3.id, content: "Hi Luke! Great — really pleased you're on board. The LOLER pre-use inspection sheets will be on site with Pete Dawson, our PM. He'll meet you at Gate 3. Bring your IRATA card and IPAF — security will want to see both." },
  { sender: freeUsers[4].id, content: "Perfect. I've got both. See you Monday morning!" },
]);

await startConversation(r2.id, freeUsers[10].id, [
  { sender: r2.id, content: "Ryan, the production team have been singing your praises after the awards show. Despite that one hiccup at the top of the show the broadcast looked incredible." },
  { sender: freeUsers[10].id, content: "Thanks Tom — that key drop haunts me but I'm glad the overall show hit the mark. The GV system at the venue was on a slightly older build than expected, which caught me off guard early on." },
  { sender: r2.id, content: "Completely understandable. We've got a studio pilot coming up in Leeds in a few weeks. Kayenne system — familiar territory for you. Would you be interested?" },
  { sender: freeUsers[10].id, content: "Absolutely. Send over the details when you have them. Leeds is easy for me." },
]);

await startConversation(r3.id, freeUsers[7].id, [
  { sender: r3.id, content: "Nina, the artists were raving about you after the arena tour. One of them texted our booker personally to say the IEM mixes were the best they'd ever had on tour. That never happens!" },
  { sender: freeUsers[7].id, content: "Ha! That's really lovely to hear. We spent a lot of time on the IEM mixes in rehearsals. When you get that right it makes everything easier." },
  { sender: r3.id, content: "We're putting together a 10-date club tour starting next month. Less pressure than the arena, obviously, but I wanted you first refusal. Interested?" },
  { sender: freeUsers[7].id, content: "I'd love to but my schedule is busy at the moment. Can you send me the full date list? I need to check a few conflicts." },
]);

console.log("Conversations created.");

// ── 10. SAVED FREELANCERS ─────────────────────────────────────────────────────

console.log("Saving freelancers…");

const toSave = [
  { recruiter_id: r1.id, freelancer_id: freeUsers[0].id },
  { recruiter_id: r1.id, freelancer_id: freeUsers[1].id },
  { recruiter_id: r1.id, freelancer_id: freeUsers[5].id },
  { recruiter_id: r1.id, freelancer_id: freeUsers[6].id },
  { recruiter_id: r2.id, freelancer_id: freeUsers[3].id },
  { recruiter_id: r2.id, freelancer_id: freeUsers[10].id },
  { recruiter_id: r3.id, freelancer_id: freeUsers[4].id },
  { recruiter_id: r3.id, freelancer_id: freeUsers[7].id },
  { recruiter_id: r3.id, freelancer_id: freeUsers[8].id },
];
await db.insert(schema.saved_freelancers).values(toSave);

// ── 11. AVAILABILITY ENQUIRIES ────────────────────────────────────────────────

console.log("Creating availability enquiries…");

const [enq1] = await db.insert(schema.availability_enquiries).values({
  employerId: r1.id,
  eventTitle: "ITV Upfronts — BFI IMAX (Availability Check)",
  eventDate: daysFromNow(14),
  callTime: "07:30",
  venueAddress: "BFI IMAX, Waterloo, London SE1 8XT",
  roleRequired: "FOH Engineer",
  agreedRate: "£380",
  additionalNotes: "L-Acoustics Kiva II on site. Primarily speech, some playback. Please confirm ASAP.",
  status: "closed",
}).returning();

const [enq2] = await db.insert(schema.availability_enquiries).values({
  employerId: r3.id,
  eventTitle: "Rigger Availability — ExCeL London Build",
  eventDate: daysFromNow(12),
  callTime: "06:30",
  venueAddress: "ExCeL London, Royal Victoria Dock, E16 1XL",
  roleRequired: "Rigger",
  agreedRate: "£290",
  additionalNotes: "IRATA Level 2 required. Two build days, possible show day addition.",
  status: "active",
}).returning();

// Responses to enquiries
await db.insert(schema.availability_responses).values([
  {
    enquiryId: enq1.id, freelancerId: freeUsers[0].id,
    token: "enq1-resp-james-001", response: "yes",
    responseNote: "I'm available. ITV at the IMAX sounds great — consider me confirmed.",
    respondedAt: daysAgo(3),
  },
  {
    enquiryId: enq1.id, freelancerId: freeUsers[7].id,
    token: "enq1-resp-nina-001", response: "no",
    responseNote: "Sorry, already committed on that date.",
    respondedAt: daysAgo(2),
  },
  {
    enquiryId: enq2.id, freelancerId: freeUsers[4].id,
    token: "enq2-resp-luke-001", response: "yes",
    responseNote: "Available for both build days. See you there.",
    respondedAt: daysAgo(1),
  },
]);

// ── 12. QUOTES & INVOICES ─────────────────────────────────────────────────────

console.log("Creating quotes and invoices…");

// Quote 1 — accepted, already converted to invoice
const [q1] = await db.insert(schema.quotes).values({
  employerId: r1.id,
  clientName: "David Wheeler",
  clientEmail: "d.wheeler@kpmg.co.uk",
  clientCompany: "KPMG LLP",
  clientAddress: "15 Canada Square, Canary Wharf, London E14 5GL",
  eventName: "KPMG Annual Leadership Conference",
  eventDate: pastDate(125),
  venueAddress: "Manchester Central, Windmill St, Manchester M2 3GX",
  quoteNumber: "QT-2026-001",
  status: "accepted",
  validUntil: pastDate(95),
  currency: "GBP",
  subtotal: 420000,   // £4,200
  vatRate: 20,
  vatAmount: 84000,
  total: 504000,
  discount: 0,
  notes: "Includes 2x days FOH + 1x Lighting Operator. Travel and accommodation additional.",
  terms: "50% deposit on acceptance. Balance due 30 days after event.",
  sentAt: daysAgo(130),
  acceptedAt: daysAgo(128),
  acceptedByName: "David Wheeler",
  bookingId: bk1.id,
}).returning();

// Invoice 1 — paid
const [inv1] = await db.insert(schema.invoices).values({
  employerId: r1.id,
  quoteId: q1.id,
  bookingId: bk1.id,
  clientName: "David Wheeler",
  clientEmail: "d.wheeler@kpmg.co.uk",
  clientCompany: "KPMG LLP",
  clientAddress: "15 Canada Square, Canary Wharf, London E14 5GL",
  invoiceNumber: "INV-2026-001",
  status: "paid",
  currency: "GBP",
  issueDate: pastDate(118),
  dueDate: pastDate(88),
  subtotal: 420000,
  vatRate: 20,
  vatAmount: 84000,
  total: 504000,
  amountPaid: 504000,
  notes: "Thank you for your business.",
  terms: "Payment by BACS to Apex AV Solutions. Sort code: 20-12-34 Account: 12345678.",
  sentAt: daysAgo(118),
  paidAt: daysAgo(95),
  eventName: "KPMG Annual Leadership Conference",
  eventDate: pastDate(125),
}).returning();

await db.insert(schema.invoice_line_items).values([
  { invoiceId: inv1.id, description: "FOH Sound Engineer — 2 days @ £350/day", quantity: 2, unitPrice: 35000, total: 70000, sortOrder: 0 },
  { invoiceId: inv1.id, description: "Lighting Operator — 2 days @ £400/day", quantity: 2, unitPrice: 40000, total: 80000, sortOrder: 1 },
  { invoiceId: inv1.id, description: "AV Equipment supplement — LED confidence screens", quantity: 1, unitPrice: 28000, total: 28000, sortOrder: 2 },
  { invoiceId: inv1.id, description: "Travel & accommodation — 3 crew", quantity: 1, unitPrice: 14000, total: 14000, sortOrder: 3 },
]);

await db.insert(schema.quote_line_items).values([
  { quoteId: q1.id, description: "FOH Sound Engineer — 2 days @ £350/day", quantity: 2, unitPrice: 35000, total: 70000, sortOrder: 0 },
  { quoteId: q1.id, description: "Lighting Operator — 2 days @ £400/day", quantity: 2, unitPrice: 40000, total: 80000, sortOrder: 1 },
  { quoteId: q1.id, description: "AV Equipment supplement", quantity: 1, unitPrice: 28000, total: 28000, sortOrder: 2 },
  { quoteId: q1.id, description: "Travel & accommodation estimate", quantity: 1, unitPrice: 14000, total: 14000, sortOrder: 3 },
]);

// Quote 2 — sent, awaiting acceptance
const [q2] = await db.insert(schema.quotes).values({
  employerId: r1.id,
  clientName: "Harriet Bloom",
  clientEmail: "h.bloom@barclays.com",
  clientCompany: "Barclays PLC",
  clientAddress: "1 Churchill Place, London E14 5HP",
  eventName: "Barclays Awards Dinner 2026",
  eventDate: daysFromNow(21),
  venueAddress: "Edwardian Manchester, Peter St, Manchester M2 5GP",
  quoteNumber: "QT-2026-002",
  status: "sent",
  validUntil: daysFromNow(7),
  currency: "GBP",
  subtotal: 380000,
  vatRate: 20,
  vatAmount: 76000,
  total: 456000,
  discount: 0,
  notes: "Pre-production day included. Programming and full show day. Crew rate includes travel.",
  terms: "50% deposit on acceptance. Balance NET 30 days post event.",
  sentAt: daysAgo(5),
}).returning();

await db.insert(schema.quote_line_items).values([
  { quoteId: q2.id, description: "Lighting Programmer — Pre-production (1 day)", quantity: 1, unitPrice: 42000, total: 42000, sortOrder: 0 },
  { quoteId: q2.id, description: "Lighting Programmer — Show day", quantity: 1, unitPrice: 42000, total: 42000, sortOrder: 1 },
  { quoteId: q2.id, description: "Stage Manager — Show day", quantity: 1, unitPrice: 35000, total: 35000, sortOrder: 2 },
  { quoteId: q2.id, description: "AV equipment hire — screens, playback, audio", quantity: 1, unitPrice: 175000, total: 175000, sortOrder: 3 },
  { quoteId: q2.id, description: "Production management & logistics", quantity: 1, unitPrice: 86000, total: 86000, sortOrder: 4 },
]);

// Invoice 2 — sent, unpaid (overdue by several days for testing)
const [inv2] = await db.insert(schema.invoices).values({
  employerId: r1.id,
  clientName: "Marcus Reid",
  clientEmail: "marcus.reid@nhsengland.nhs.uk",
  clientCompany: "NHS England",
  clientAddress: "Wellington House, 133-155 Waterloo Road, London SE1 8UG",
  invoiceNumber: "INV-2026-002",
  status: "sent",
  currency: "GBP",
  issueDate: pastDate(45),
  dueDate: pastDate(15),  // overdue
  subtotal: 336000,
  vatRate: 20,
  vatAmount: 67200,
  total: 403200,
  amountPaid: 0,
  notes: "Relates to NHS Conference — ICC Birmingham.",
  terms: "Payment due within 30 days. BACS preferred.",
  sentAt: daysAgo(45),
  eventName: "NHS Leadership Conference",
  eventDate: pastDate(75),
}).returning();

await db.insert(schema.invoice_line_items).values([
  { invoiceId: inv2.id, description: "Video Technician — 3 days @ £280/day", quantity: 3, unitPrice: 28000, total: 84000, sortOrder: 0 },
  { invoiceId: inv2.id, description: "AV Technician — 3 days @ £260/day", quantity: 3, unitPrice: 26000, total: 78000, sortOrder: 1 },
  { invoiceId: inv2.id, description: "LED wall processing & rigging", quantity: 1, unitPrice: 95000, total: 95000, sortOrder: 2 },
  { invoiceId: inv2.id, description: "Delivery, installation & collection", quantity: 1, unitPrice: 79000, total: 79000, sortOrder: 3 },
]);

// Invoice 3 — draft (being prepared)
const [inv3] = await db.insert(schema.invoices).values({
  employerId: r2.id,
  clientName: "Emma Forsyth",
  clientEmail: "e.forsyth@nfluk.com",
  clientCompany: "NFL UK Ltd",
  clientAddress: "11 Buckingham Gate, London SW1E 6LB",
  invoiceNumber: "INV-2026-003",
  status: "draft",
  currency: "GBP",
  issueDate: daysFromNow(0),
  dueDate: daysFromNow(30),
  subtotal: 196000,
  vatRate: 20,
  vatAmount: 39200,
  total: 235200,
  amountPaid: 0,
  notes: "Draft — pending final confirmation of crew hours.",
  terms: "NET 30 days.",
  eventName: "NFL London OB Coverage",
  eventDate: pastDate(7),
}).returning();

await db.insert(schema.invoice_line_items).values([
  { invoiceId: inv3.id, description: "Camera Operator — 2 days @ £450/day", quantity: 2, unitPrice: 45000, total: 90000, sortOrder: 0 },
  { invoiceId: inv3.id, description: "Vision Mixer — 2 days @ £480/day", quantity: 2, unitPrice: 48000, total: 96000, sortOrder: 1 },
  { invoiceId: inv3.id, description: "Equipment & travel supplement", quantity: 1, unitPrice: 10000, total: 10000, sortOrder: 2 },
]);

// Quote 3 — draft
const [q3] = await db.insert(schema.quotes).values({
  employerId: r3.id,
  clientName: "Jordan Blake",
  clientEmail: "j.blake@redbull.com",
  clientCompany: "Red Bull Media House",
  clientAddress: "5 Hanover Quay, Dublin 2, Ireland",
  eventName: "Red Bull Summer Activation 2026",
  eventDate: daysFromNow(50),
  venueAddress: "TBC — Central London",
  quoteNumber: "QT-2026-003",
  status: "draft",
  validUntil: daysFromNow(30),
  currency: "GBP",
  subtotal: 720000,
  vatRate: 20,
  vatAmount: 144000,
  total: 864000,
  discount: 0,
  notes: "Draft quote pending final crew confirmation. Indicative pricing only.",
  terms: "40% deposit on acceptance, 60% NET 30 days post event.",
}).returning();

await db.insert(schema.quote_line_items).values([
  { quoteId: q3.id, description: "Production Manager — 5 days", quantity: 5, unitPrice: 60000, total: 300000, sortOrder: 0 },
  { quoteId: q3.id, description: "Stage Manager — 5 days", quantity: 5, unitPrice: 32000, total: 160000, sortOrder: 1 },
  { quoteId: q3.id, description: "Rigger x2 — 3 days each", quantity: 6, unitPrice: 29000, total: 174000, sortOrder: 2 },
  { quoteId: q3.id, description: "Production coordination & logistics fee", quantity: 1, unitPrice: 86000, total: 86000, sortOrder: 3 },
]);

console.log("Quotes and invoices created.");

// ── 13. NOTIFICATIONS ─────────────────────────────────────────────────────────

console.log("Creating notifications…");

await db.insert(schema.notifications).values([
  { user_id: r1.id, type: "application_update", title: "New application", message: "James Harris has applied for FOH Engineer — ITV Upfronts.", is_read: false, priority: "normal" },
  { user_id: r1.id, type: "application_update", title: "New application", message: "Nina Walsh has applied for FOH Engineer — ITV Upfronts.", is_read: false, priority: "normal" },
  { user_id: r1.id, type: "rating_received", title: "Rating sent", message: "Your rating for the KPMG Conference crew has been published.", is_read: true, priority: "low" },
  { user_id: freeUsers[0].id, type: "application_update", title: "Application shortlisted", message: "You've been shortlisted for FOH Engineer — ITV Upfronts at BFI IMAX.", is_read: false, priority: "high" },
  { user_id: freeUsers[0].id, type: "rating_received", title: "New review from Apex AV", message: "Sarah Mitchell left you a 5-star review for the KPMG Conference.", is_read: true, priority: "normal" },
  { user_id: freeUsers[4].id, type: "application_update", title: "Application shortlisted", message: "You've been shortlisted for Rigger — Indoor Corporate Show Build at ExCeL London.", is_read: false, priority: "high" },
  { user_id: freeUsers[4].id, type: "system", title: "Brief received", message: "Your event brief for the ExCeL London build has been sent. Please acknowledge.", is_read: false, priority: "high" },
  { user_id: r3.id, type: "system", title: "Brief acknowledged", message: "Luke Jenkins has acknowledged the ExCeL London brief.", is_read: false, priority: "normal" },
  { user_id: freeUsers[1].id, type: "rating_received", title: "New 5-star review", message: "Apex AV Solutions left you a 5-star review for the Barclays Awards Dinner.", is_read: true, priority: "normal" },
  { user_id: r2.id, type: "application_update", title: "New application", message: "Aisha Osei has applied for Broadcast Camera Operator — ENG Package.", is_read: false, priority: "normal" },
]);

// ── 14. REFERENCES ────────────────────────────────────────────────────────────

console.log("Creating freelancer references…");

await db.insert(schema.freelancer_references).values([
  {
    freelancer_id: freeUsers[0].id,
    referee_name: "Phil Carter",
    referee_organisation: "SFL Group",
    referee_email: "p.carter@sfl.co.uk",
    referee_role: "Head of Audio",
    q1_confirmed: true,
    q2_rating: "excellent",
    q3_would_work_again: "absolutely",
    comment: "James is one of the most professional audio engineers I've worked with. Reliable, skilled, and great with clients.",
    badge_result: "highly_recommended",
    is_flagged: false,
    verification_type: "email",
    verified_email: "p.carter@sfl.co.uk",
    email_domain: "sfl.co.uk",
    domain_trust_level: "high",
  },
  {
    freelancer_id: freeUsers[1].id,
    referee_name: "Amanda Jones",
    referee_organisation: "HSL Group",
    referee_email: "a.jones@hsl.co.uk",
    referee_role: "Lighting Director",
    q1_confirmed: true,
    q2_rating: "excellent",
    q3_would_work_again: "absolutely",
    comment: "Priya is a phenomenal programmer. Creative, technically brilliant, and always prepared.",
    badge_result: "highly_recommended",
    is_flagged: false,
    verification_type: "email",
    verified_email: "a.jones@hsl.co.uk",
    email_domain: "hsl.co.uk",
    domain_trust_level: "high",
  },
  {
    freelancer_id: freeUsers[8].id,
    referee_name: "Kath Reynolds",
    referee_organisation: "George P. Johnson",
    referee_email: "k.reynolds@gpj.com",
    referee_role: "Executive Producer",
    q1_confirmed: true,
    q2_rating: "excellent",
    q3_would_work_again: "absolutely",
    comment: "Oliver managed our most complex global event without breaking a sweat. A consummate production professional.",
    badge_result: "highly_recommended",
    is_flagged: false,
    verification_type: "email",
    verified_email: "k.reynolds@gpj.com",
    email_domain: "gpj.com",
    domain_trust_level: "medium",
  },
]);

console.log("References created.");

// ── Done ─────────────────────────────────────────────────────────────────────

await client.end();

console.log(`
✅ Dev seed complete!

RECRUITER ACCOUNTS:
  sarah@apexav.co.uk      → Apex AV Solutions (main test account)
  tom@northernlights.tv   → Northern Lights Television
  claire@peaklive.com     → Peak Live Events

FREELANCER ACCOUNTS (all verified, active):
  james.harris@gmail.com      → FOH Sound Engineer
  priya.nair@gmail.com        → Lighting Programmer
  ben.watts@hotmail.co.uk     → Video Technician
  aisha.osei@gmail.com        → Broadcast Camera Operator
  luke.jenkins@gmail.com      → Rigger
  chloe.barnes@icloud.com     → Stage Manager
  dan.moran@gmail.com         → AV Technician
  nina.walsh@gmail.com        → Monitor Engineer
  oliver.stead@gmail.com      → Production Manager
  fatima.ali@yahoo.co.uk      → Event Producer
  ryan.cooper@gmail.com       → Vision Mixer
  sian.hughes@gmail.com       → Wardrobe Technician

ALL PASSWORDS: Password123!

WHAT'S BEEN SEEDED:
  24 jobs (past, active, future)
  18 bookings (all statuses: completed, confirmed, briefed, cancelled, enquired)
  23 applications (hired, shortlisted, applied, rejected)
  2 event briefs (one acknowledged, one sent)
  10 ratings with written reviews
  5 conversations with messages
  3 quotes (accepted, sent, draft)
  3 invoices (paid, overdue, draft)
  3 freelancer references
  10 notifications
  9 saved freelancers
  2 availability enquiries with responses
`);
