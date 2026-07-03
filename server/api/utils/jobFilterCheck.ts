/**
 * Standalone accuracy check for the external job filter. Run with:
 *   npx tsx server/api/utils/jobFilterCheck.ts
 * Re-run after any change to EVENT_ROLE_KEYWORDS/EXCLUDE_KEYWORDS or the
 * scoring weights/threshold in jobAggregator.ts to catch regressions.
 */
import { filterEventIndustryJobs, scoreJob } from "./jobFilter.js";

interface SampleCase {
  label: string;
  title: string;
  description: string;
  expected: boolean; // true = should be included
}

interface CategoryCase extends SampleCase {
  categoryTag: string;
}

const CASES: SampleCase[] = [
  // --- True positives (AV / production / broadcast) ---
  {
    label: "AV Technician - corporate events",
    expected: true,
    title: "AV Technician",
    description:
      "Setting up PA systems, lighting desks and projectors for corporate conferences. Experience with Avolites and vMix required.",
  },
  {
    label: "Freelance Lighting Engineer",
    expected: true,
    title: "Freelance Lighting Engineer",
    description:
      "Operating lighting desks and rigging LED walls for live events. Grandma2 experience preferred.",
  },
  {
    label: "Broadcast Technician - live streaming",
    expected: true,
    title: "Broadcast Technician",
    description:
      "Vision mixing and live stream production for sports broadcasts. Signal flow and camera operation required.",
  },
  {
    label: "Sound Engineer - touring",
    expected: true,
    title: "Sound Engineer",
    description: "Mixing desk operation and RF microphones setup for touring productions.",
  },
  {
    label: "Stage Manager - theatre production",
    expected: true,
    title: "Stage Manager",
    description: "Coordinating technical crew and rigging for touring theatre productions.",
  },
  {
    label: "Video Technician - conference AV",
    expected: true,
    title: "Video Technician",
    description:
      "Conference AV support including projection technician duties and camera operator work.",
  },
  {
    label: "Vision Mixer freelance role",
    expected: true,
    title: "Vision Mixer",
    description:
      "vMix and vision mixing for live broadcast events, streaming technician experience a plus.",
  },
  {
    label: "LED Technician - festivals",
    expected: true,
    title: "LED Technician",
    description: "LED wall installation and video production support for outdoor events.",
  },
  {
    label: "Production Technician - AV company",
    expected: true,
    title: "Production Technician",
    description:
      "Working with an audio visual company providing technical support for conference AV and live production.",
  },
  {
    label: "Freelance AV Crew - low title signal",
    expected: true,
    title: "Freelance Technician - Cardiff",
    description:
      "We need an experienced audio visual technician for signal flow, mixing desk and led wall work at a major conference.",
  },

  // --- True negatives (catering / hospitality / marketing / generic / dev) ---
  {
    label: "Event Catering Chef",
    expected: false,
    title: "Event Catering Chef",
    description:
      "Head chef required for banquet and catering events, kitchen and menu experience essential.",
  },
  {
    label: "Hotel Front of House",
    expected: false,
    title: "Front of House Assistant",
    description: "Hotel reception and guest services role, hospitality experience required.",
  },
  {
    label: "Wedding Coordinator",
    expected: false,
    title: "Wedding and Events Coordinator",
    description: "Planning weddings and festivals, liaising with venues and catering suppliers.",
  },
  {
    label: "Marketing Executive - events",
    expected: false,
    title: "Marketing Executive",
    description:
      "Running social media campaigns and brand ambassador promotions for event marketing.",
  },
  {
    label: "Event Staff - promo",
    expected: false,
    title: "Event Staff Needed",
    description:
      "Promotional event staff wanted for brand activations, customer service and ticket sales.",
  },
  {
    label: "Bartender at venue",
    expected: false,
    title: "Bartender",
    description: "Bar staff needed for busy venue, cocktail and hospitality experience preferred.",
  },
  {
    label: "Software Developer",
    expected: false,
    title: "Full Stack Developer",
    description:
      "React developer needed for web development, javascript and node experience required.",
  },
  {
    label: "Sales Executive - AV company (borderline title)",
    expected: false,
    title: "Sales Executive - AV Solutions",
    description:
      "Selling AV equipment and mixing desks to clients, achieving sales targets and KPIs, managing a sales pipeline.",
  },
  {
    label: "Event Manager - corporate",
    expected: false,
    title: "Event Manager",
    description:
      "Managing corporate events end to end, liaising with catering and venue teams, project management experience needed.",
  },
  {
    label: "Exhibition Stand Staff",
    expected: false,
    title: "Exhibition Stand Staff",
    description:
      "Promotional staff for trade show stands, brand ambassador and customer engagement.",
  },
  {
    label: "HR Administrator",
    expected: false,
    title: "HR Administrator",
    description:
      "Office administrator role supporting human resources, booking meeting rooms and managing records.",
  },
  {
    label: "Chef de Partie",
    expected: false,
    title: "Chef de Partie",
    description: "Kitchen role in busy restaurant, culinary and food preparation skills essential.",
  },
  {
    label: "Customer Service Advisor",
    expected: false,
    title: "Customer Service Advisor",
    description: "Handling customer service enquiries, ticket sales and front desk duties.",
  },
  {
    label: "PR Account Manager",
    expected: false,
    title: "PR Account Manager",
    description:
      "Public relations and client services role managing PR campaigns and content calendars.",
  },
  {
    label: "Data Scientist",
    expected: false,
    title: "Data Scientist",
    description:
      "Machine learning and data engineering role using python for data science projects.",
  },
];

// Category-gate cases (exercise the full filterEventIndustryJobs pipeline,
// not just scoreJob, since the category gate runs before scoring).
const CATEGORY_CASES: CategoryCase[] = [
  {
    // Real posting pulled live from Adzuna: a genuine AV role Adzuna files
    // under "it-jobs". Confirms that category isn't hard-excluded.
    label: "Senior AV Technician tagged it-jobs by Adzuna",
    expected: true,
    categoryTag: "it-jobs",
    title: "Senior AV Technician",
    description:
      "Supporting the delivery of live events, providing professional audio visual solutions across conferences, exhibitions, awards ceremonies, corporate events, gala dinners and sporting occasions.",
  },
  {
    label: "Catering job tagged catering-jobs by Adzuna",
    expected: false,
    categoryTag: "catering-jobs",
    title: "Event Chef",
    description: "Preparing food for corporate hospitality events, kitchen experience required.",
  },
  {
    // Real posting pulled live from Adzuna: BAE Systems factory paint shop
    // role tagged manufacturing-jobs. Title alone ("production technician")
    // would otherwise score +3 and pass with no other signal either way.
    label: "Production Technician (Sprayer) tagged manufacturing-jobs by Adzuna",
    expected: false,
    categoryTag: "manufacturing-jobs",
    title: "Production Technician (Sprayer)",
    description:
      "Join BAE Systems and you'll be part of something bigger, delivering advanced technology-led defence, aerospace and security solutions.",
  },
];

function run() {
  let pass = 0;
  const failures: string[] = [];

  for (const c of CASES) {
    const result = scoreJob({ title: c.title, description: c.description });
    const ok = result.included === c.expected;
    if (ok) pass++;
    else failures.push(c.label);

    console.log(
      `${ok ? "PASS" : "FAIL"} | expected=${c.expected} actual=${result.included} score=${result.score} | ${c.label}`
    );
  }

  const total = CASES.length + CATEGORY_CASES.length;

  for (const c of CATEGORY_CASES) {
    const [result] = filterEventIndustryJobs([
      {
        title: c.title,
        description: c.description,
        company: "Test Co",
        categoryTag: c.categoryTag,
      },
    ]);
    const included = Boolean(result);
    const ok = included === c.expected;
    if (ok) pass++;
    else failures.push(c.label);

    console.log(`${ok ? "PASS" : "FAIL"} | expected=${c.expected} actual=${included} | ${c.label}`);
  }

  console.log(`\n${pass}/${total} passed`);
  if (failures.length) {
    console.log(`Failures: ${failures.join(", ")}`);
    process.exitCode = 1;
  }
}

run();
