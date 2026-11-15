import type { HelpEntry } from "../types";

// ============================================================================
// Tax estimate — contextual help.
//
// Copy rules: one sentence, say what it does for the user, British English,
// no "click here", never restate the label.
//
// Two extra rules for this file, because it is about money owed to HMRC:
//   1. State what a thing IS, never what the user SHOULD do. These bubbles
//      explain a field; they are not advice, and the Terms say EventLink does
//      not give tax advice.
//   2. Where a figure depends on the user's own circumstances, say so rather
//      than implying the estimate settles it.
// ============================================================================

const entries: HelpEntry[] = [
  // ── The estimate itself ────────────────────────────────────────────────────

  {
    key: "tax.estimate",
    scope: "feature",
    title: "Your tax estimate",
    body: "Worked out from the records you've entered, for your own planning and your accountant's — EventLink doesn't submit anything to HMRC.",
    audience: ["freelancer"],
    priority: 9,
    oncePerUser: true,
    minVisits: 1,
    maxVisits: 10,
    version: 1,
  },
  {
    key: "tax.estimate.otherIncome",
    scope: "field",
    title: "Why this matters",
    body: "Your personal allowance is shared across everything you earn, so a PAYE job or a pension changes the tax on your freelance profit.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "tax.estimate.adjustedNetIncome",
    scope: "field",
    body: "Your total income less pension contributions and Gift Aid — the figure HMRC uses for the personal allowance taper and the Child Benefit charge.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Allowances and bands ───────────────────────────────────────────────────

  {
    key: "tax.personalAllowance",
    scope: "field",
    body: "The amount you can earn before paying Income Tax — it reduces by £1 for every £2 of income above £100,000 and disappears at £125,140.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "tax.tradingAllowance",
    scope: "field",
    body: "You can deduct this instead of your actual expenses, which is worth doing only if your expenses come to less than the allowance.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "tax.scotland",
    scope: "field",
    body: "Scottish taxpayers have different Income Tax bands — National Insurance is the same across the UK.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── National Insurance ─────────────────────────────────────────────────────

  {
    key: "tax.class4",
    scope: "field",
    title: "Class 4 National Insurance",
    body: "Charged on your profits above the lower threshold, alongside Income Tax, and collected through Self Assessment.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "tax.class2",
    scope: "field",
    title: "Class 2 National Insurance",
    body: "You no longer have to pay it above the Small Profits Threshold and still get the National Insurance credit — below the threshold it's voluntary, and paying it protects that year towards your State Pension.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Deductions the user enters ─────────────────────────────────────────────

  {
    key: "tax.pension",
    scope: "field",
    title: "Gross, not what left your account",
    body: "A £200 monthly contribution is £3,000 gross across the year once basic rate relief is added — the gross figure is what extends your basic rate band.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "tax.giftAid",
    scope: "field",
    body: "Donations made under Gift Aid extend your basic rate band in the same way pension contributions do, so higher rate relief is claimed through Self Assessment.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "tax.workingFromHome",
    scope: "field",
    title: "HMRC flat rate",
    body: "A set monthly amount based on the hours you work at home, which saves working out a share of your actual bills — phone and internet are claimed separately as expenses.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "tax.losses",
    scope: "field",
    body: "A loss from an earlier year can be set against this year's profit, which is worth checking if you've had a quiet season.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "tax.marriageAllowance",
    scope: "field",
    body: "Where one partner earns below the personal allowance and the other is a basic rate taxpayer, part of the allowance can be transferred between them.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Charges and payments ───────────────────────────────────────────────────

  {
    key: "tax.hicbc",
    scope: "field",
    title: "High Income Child Benefit Charge",
    body: "Applies where the higher earner's adjusted net income is over £60,000, rising to the full amount of the Child Benefit at £80,000 — pension contributions reduce it.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "tax.studentLoan",
    scope: "field",
    body: "Repaid at a percentage of your total income above the threshold for your plan, and collected with your tax through Self Assessment.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "tax.paymentsOnAccount",
    scope: "field",
    title: "Why January is bigger",
    body: "Alongside the tax for the year just ended you usually pay half of it again towards the next year, with the second half due in July.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Mileage and vehicles ───────────────────────────────────────────────────

  {
    key: "tax.mileage",
    scope: "field",
    title: "HMRC flat rate per mile",
    body: "A set rate covering fuel, insurance, servicing and wear — the rate drops once you pass 10,000 business miles in a tax year.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "tax.vehicleCapitalAllowance",
    scope: "field",
    title: "Cars work differently",
    body: "A car can't be claimed as an ordinary expense the way a van or a tool can — it goes through capital allowances at a rate set by its emissions.",
    audience: ["freelancer"],
    version: 1,
  },
  {
    key: "tax.mileageOrCosts",
    scope: "field",
    body: "For any one vehicle it's either the flat rate per mile or its actual running costs — not both.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Making Tax Digital ─────────────────────────────────────────────────────

  {
    key: "tax.quarters",
    scope: "feature",
    title: "Your quarters",
    body: "The four periods HMRC uses for Making Tax Digital, shown here so the figures are familiar before quarterly reporting applies to you.",
    audience: ["freelancer"],
    priority: 7,
    oncePerUser: true,
    minVisits: 1,
    maxVisits: 8,
    version: 1,
  },
  {
    key: "tax.mtd",
    scope: "feature",
    title: "Making Tax Digital",
    body: "Quarterly updates to HMRC start from April 2027 for qualifying income over £30,000, and April 2028 over £20,000 — qualifying income means turnover, not profit.",
    audience: ["freelancer"],
    version: 1,
  },

  // ── Basis ──────────────────────────────────────────────────────────────────

  {
    key: "tax.cashBasis",
    scope: "field",
    title: "Cash basis",
    body: "Income counts in the year you were paid rather than the year you did the work, which is why a job's paid date matters.",
    audience: ["freelancer"],
    version: 1,
  },
];

export default entries;
