import { describe, it, expect } from "vitest";
import {
  vatQuartersOverlapping,
  vatPaidInRange,
  uninvoicedEarnings,
  vatQuarterStatus,
  computeVatReturn,
  recentVatQuarters,
  vatTreatmentNote,
  type VatInvoiceLike,
  type VatExpenseLike,
} from "./vat-return";
import { reclaimsInputVat } from "./expense-totals";

describe("recentVatQuarters", () => {
  it("stagger 1 ends quarters in Mar/Jun/Sep/Dec, newest first", () => {
    const qs = recentVatQuarters(1, "2026-11-22", 3);
    expect(qs.map((q) => [q.from, q.to])).toEqual([
      ["2026-10-01", "2026-12-31"],
      ["2026-07-01", "2026-09-30"],
      ["2026-04-01", "2026-06-30"],
    ]);
    expect(qs[0].label).toBe("Oct–Dec 2026");
  });

  it("stagger 2 ends in Apr/Jul/Oct/Jan and crosses the year", () => {
    const [q] = recentVatQuarters(2, "2026-11-22", 1);
    expect([q.from, q.to, q.label]).toEqual(["2026-11-01", "2027-01-31", "Nov 2026–Jan 2027"]);
  });

  it("stagger 3 ends in May/Aug/Nov/Feb, including a leap February", () => {
    const qs = recentVatQuarters(3, "2028-01-10", 2);
    expect([qs[0].from, qs[0].to]).toEqual(["2027-12-01", "2028-02-29"]);
    expect([qs[1].from, qs[1].to]).toEqual(["2027-09-01", "2027-11-30"]);
  });

  it("a quarter's last day still belongs to it", () => {
    expect(recentVatQuarters(1, "2026-12-31", 1)[0].to).toBe("2026-12-31");
    expect(recentVatQuarters(1, "2027-01-01", 1)[0].from).toBe("2027-01-01");
  });

  it("is due one month and seven days after the quarter ends", () => {
    expect(recentVatQuarters(1, "2027-02-01", 1)[0].due).toBe("2027-05-07");
    expect(recentVatQuarters(1, "2026-11-01", 1)[0].due).toBe("2027-02-07");
  });
});

const Q = { from: "2026-10-01", to: "2026-12-31" };

const inv = (over: Partial<VatInvoiceLike> = {}): VatInvoiceLike => ({
  status: "sent",
  archived: false,
  currency: "GBP",
  issue_date: "2026-11-01",
  paid_date: null,
  paid_amount_pence: null,
  subtotal_pence: 100_000,
  vat_pence: 20_000,
  total_pence: 120_000,
  ...over,
});

const exp = (over: Partial<VatExpenseLike> = {}): VatExpenseLike => ({
  expense_date: "2026-11-05",
  net_amount_pence: 10_000,
  vat_amount_pence: 2_000,
  business_use_percent: 100,
  allowable: true,
  currency: "GBP",
  ...over,
});

describe("computeVatReturn — standard accounting", () => {
  it("output VAT on invoices issued in the quarter, input VAT on costs in it", () => {
    const r = computeVatReturn(Q, [inv()], [exp()], "standard", null);
    expect(r).toMatchObject({ output_pence: 20_000, input_pence: 2_000, net_pence: 18_000 });
    expect(r.invoice_count).toBe(1);
    expect(r.expense_count).toBe(1);
  });

  it("ignores drafts, cancelled, archived and out-of-quarter invoices", () => {
    const r = computeVatReturn(
      Q,
      [
        inv({ status: "draft" }),
        inv({ status: "cancelled" }),
        inv({ archived: true }),
        inv({ issue_date: "2026-09-30" }),
      ],
      [],
      "standard",
      null
    );
    expect(r.output_pence).toBe(0);
    expect(r.invoice_count).toBe(0);
  });

  it("reclaims only the business share of input VAT, and nothing on a disallowed cost", () => {
    const r = computeVatReturn(
      Q,
      [],
      [exp({ business_use_percent: 50 }), exp({ allowable: false })],
      "standard",
      null
    );
    expect(r.input_pence).toBe(1_000);
  });

  it("a quarter with more input than output is a repayment (negative)", () => {
    const r = computeVatReturn(Q, [], [exp()], "standard", null);
    expect(r.net_pence).toBe(-2_000);
  });

  it("leaves non-sterling records out and counts them", () => {
    const r = computeVatReturn(
      Q,
      [inv({ currency: "EUR" })],
      [exp({ currency: "USD" })],
      "standard",
      null
    );
    expect(r).toMatchObject({ output_pence: 0, input_pence: 0, other_currency: 2 });
  });
});

describe("computeVatReturn — cash accounting", () => {
  it("output VAT when paid, not when issued", () => {
    const issuedNotPaid = inv({ issue_date: "2026-11-01" });
    const paidThisQuarter = inv({
      issue_date: "2026-09-15",
      status: "paid",
      paid_date: "2026-10-10",
      paid_amount_pence: 120_000,
    });
    const r = computeVatReturn(Q, [issuedNotPaid, paidThisQuarter], [], "cash", null);
    expect(r.output_pence).toBe(20_000);
    expect(r.invoice_count).toBe(1);
  });

  it("a part payment carries its share of the VAT", () => {
    const r = computeVatReturn(
      Q,
      [inv({ status: "paid", paid_date: "2026-11-01", paid_amount_pence: 60_000 })],
      [],
      "cash",
      null
    );
    expect(r.output_pence).toBe(10_000);
  });
});

describe("computeVatReturn — Flat Rate Scheme", () => {
  it("owes the flat rate on VAT-inclusive turnover and reclaims no input VAT", () => {
    // £1,200 incl. VAT at 12.5% = £150
    const r = computeVatReturn(Q, [inv()], [exp()], "flat_rate", 1250);
    expect(r).toMatchObject({
      output_pence: 15_000,
      input_pence: 0,
      net_pence: 15_000,
      flat_rate_turnover_pence: 120_000,
    });
  });

  it("flags single purchases of £2,000+ incl. VAT as possible capital items", () => {
    const r = computeVatReturn(
      Q,
      [],
      [exp({ net_amount_pence: 166_667, vat_amount_pence: 33_333 }), exp()],
      "flat_rate",
      1250
    );
    expect(r.capital_candidates).toBe(1);
    expect(r.input_pence).toBe(0);
  });

  it("owes nothing until a rate is set, rather than guessing one", () => {
    expect(computeVatReturn(Q, [inv()], [], "flat_rate", null).output_pence).toBe(0);
  });
});

describe("which expenses count net", () => {
  it("only a registered freelancer outside the Flat Rate Scheme reclaims input VAT", () => {
    expect(reclaimsInputVat(null)).toBe(false);
    expect(reclaimsInputVat({ vat_registered: false, vat_scheme: "standard" })).toBe(false);
    expect(reclaimsInputVat({ vat_registered: true, vat_scheme: "standard" })).toBe(true);
    expect(reclaimsInputVat({ vat_registered: true, vat_scheme: "cash" })).toBe(true);
    expect(reclaimsInputVat({ vat_registered: true, vat_scheme: "flat_rate" })).toBe(false);
  });

  it("the Books note changes only for registered freelancers", () => {
    expect(vatTreatmentNote({ vat_registered: false })).toBeNull();
    expect(vatTreatmentNote({ vat_registered: true, vat_scheme: "standard" })).toBe(
      "Figures exclude VAT. Your VAT is accounted for separately."
    );
    expect(vatTreatmentNote({ vat_registered: true, vat_scheme: "flat_rate" })).toMatch(
      /^Flat Rate Scheme/
    );
  });
});

describe("vatQuartersOverlapping", () => {
  it("covers a whole tax year, reaching outside it at both ends", () => {
    const qs = vatQuartersOverlapping(1, "2026-04-06", "2027-04-05");
    expect(qs.map((q) => `${q.from}..${q.to}`)).toEqual([
      "2026-04-01..2026-06-30",
      "2026-07-01..2026-09-30",
      "2026-10-01..2026-12-31",
      "2027-01-01..2027-03-31",
      "2027-04-01..2027-06-30",
    ]);
  });

  it("follows the stagger", () => {
    const qs = vatQuartersOverlapping(2, "2026-04-06", "2027-04-05");
    expect(qs[0].from).toBe("2026-02-01");
    expect(qs[qs.length - 1].to).toBe("2027-04-30");
  });

  it("returns nothing for an empty range", () => {
    expect(vatQuartersOverlapping(1, "2027-01-01", "2026-01-01")).toEqual([]);
  });
});

describe("vatPaidInRange", () => {
  it("nets repayments and ignores payments outside the range", () => {
    const payments = [
      { paid_date: "2026-05-07", amount_pence: 120_000 },
      { paid_date: "2026-08-07", amount_pence: -30_000 },
      { paid_date: "2027-05-07", amount_pence: 50_000 },
      { paid_date: null, amount_pence: 999 },
    ];
    expect(vatPaidInRange(payments, "2026-04-06", "2027-04-05")).toBe(90_000);
  });
});

describe("uninvoicedEarnings", () => {
  const base = {
    invoice_id: null,
    archived: false,
    currency: "GBP",
    paid_date: null,
    invoiced_date: null,
    work_date: "2026-05-10",
    gross_amount_pence: 10_000,
  };

  const Q2 = ["2026-04-01", "2026-06-30"] as const;
  // Worked and invoiced in the quarter, paid after it
  const paidLate = { ...base, invoiced_date: "2026-06-15", paid_date: "2026-07-02" };

  it("standard: placed by invoice date, paid or not, else the date worked", () => {
    const r = uninvoicedEarnings(
      [
        base, // never invoiced: work date
        paidLate,
        {
          ...base,
          work_date: "2026-03-20",
          invoiced_date: "2026-04-02",
          gross_amount_pence: 5_000,
        },
        { ...base, invoiced_date: "2026-07-01" }, // invoiced in the next quarter
        { ...base, invoice_id: 9 }, // already in Box 1 via its invoice
        { ...base, archived: true },
        { ...base, currency: "EUR" },
      ],
      ...Q2,
      "standard"
    );
    expect(r).toEqual({ count: 3, pence: 25_000 });
    // The late payment belongs to the quarter it was invoiced in, not paid in
    expect(uninvoicedEarnings([paidLate], "2026-07-01", "2026-09-30", "standard").count).toBe(0);
  });

  it("reads currency as the rest of Books does: case, spaces and blank are sterling", () => {
    const entries = ["gbp", "Gbp", " GBP ", "", null].map((currency) => ({ ...base, currency }));
    expect(uninvoicedEarnings(entries, ...Q2, "standard").count).toBe(5);
    expect(uninvoicedEarnings([{ ...base, currency: "usd" }], ...Q2, "standard").count).toBe(0);
  });

  it("flat rate follows the invoice date too, as its turnover does", () => {
    expect(uninvoicedEarnings([paidLate], ...Q2, "flat_rate").count).toBe(1);
  });

  it("cash: placed by paid date, and unpaid entries don't count", () => {
    expect(uninvoicedEarnings([paidLate], ...Q2, "cash").count).toBe(0);
    expect(uninvoicedEarnings([paidLate], "2026-07-01", "2026-09-30", "cash").count).toBe(1);
    expect(uninvoicedEarnings([base], ...Q2, "cash").count).toBe(0);
  });
});

describe("vatQuarterStatus", () => {
  const q = { from: "2026-04-01", to: "2026-06-30", due: "2026-08-07" };
  const late = "2026-11-22";

  it("never calls a repayment quarter overdue", () => {
    expect(vatQuarterStatus(q, -12_753, null, late)).toBe("Repayment due from HMRC");
    expect(vatQuarterStatus(q, 0, null, late)).toBe("Nothing to pay");
  });

  it("calls an unpaid amount owed overdue only after the due date", () => {
    expect(vatQuarterStatus(q, 5_000, null, late)).toBe("Overdue — no payment recorded");
    expect(vatQuarterStatus(q, 5_000, null, "2026-07-15")).toBe("Return due");
  });

  it("reports a recorded payment or repayment, and quarters not yet ended", () => {
    expect(vatQuarterStatus(q, 5_000, { amount_pence: 5_000 }, late)).toBe("Paid");
    expect(vatQuarterStatus(q, -12_753, { amount_pence: -12_753 }, late)).toBe("Repaid");
    expect(vatQuarterStatus(q, 5_000, null, "2026-03-31")).toBe("Not started");
    expect(vatQuarterStatus(q, 5_000, null, "2026-06-30")).toBe("In progress");
  });
});
