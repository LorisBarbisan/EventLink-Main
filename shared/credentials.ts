// ============================================================
// Credential vocabulary and derived-status helpers.
//
// Kept in its own module, free of any drizzle/database imports, so the client
// can import these runtime values (DOCUMENT_TYPE_META, credentialStatus, …)
// without pulling the whole ORM schema — and the server re-exports them through
// shared/schema.ts so existing imports keep working.
// ============================================================

// Document type constants for the controlled list.
export const DOCUMENT_TYPES = [
  "PLI",
  "BS7909",
  "IPAF",
  "NRC",
  "PASMA",
  "First Aid",
  "IRATA",
  "CSCS",
  "Electrical Safety",
  "Working at Height",
  "Risk Assessment",
  "Method Statement",
  "Other",
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

// A credential (PAL card, PLI, First Aid…) expires and carries an expiry date.
// A job_document (risk assessment, method statement) is per-job paperwork that
// does not expire and must never be asked for one.
export type CredentialClass = "credential" | "job_document";

/**
 * Per-type metadata that lets the upload form branch on class and, where a
 * scheme publishes a fixed validity, suggest an expiry from the issue date.
 *
 * RULE: never ship a `defaultValidityMonths` number with
 * `validityConfirmed: false`. If a scheme's rule isn't confirmed, leave the
 * number null and have the freelancer type the date. A wrong derived date that
 * costs someone a booking is worse than an empty field.
 */
export const DOCUMENT_TYPE_META: Record<
  DocumentType,
  {
    class: CredentialClass;
    defaultValidityMonths: number | null; // null = must be entered by hand
    issuingBodyHint: string | null;
    validitySource: string; // where the number came from
    validityConfirmed: boolean; // false = someone must check this
  }
> = {
  PLI: {
    class: "credential",
    defaultValidityMonths: 12,
    issuingBodyHint: "Your insurer",
    validitySource: "Typically an annual policy — always confirm against the schedule",
    validityConfirmed: true,
  },
  IPAF: {
    class: "credential",
    defaultValidityMonths: 60,
    issuingBodyHint: "IPAF",
    validitySource: "PAL cards are valid 5 years (IPAF)",
    validityConfirmed: true,
  },
  PASMA: {
    class: "credential",
    defaultValidityMonths: 60,
    issuingBodyHint: "PASMA",
    validitySource: "PASMA cards are valid 5 years",
    validityConfirmed: true,
  },
  "First Aid": {
    class: "credential",
    defaultValidityMonths: 36,
    issuingBodyHint: "Training provider",
    validitySource: "First Aid at Work is valid 3 years (HSE)",
    validityConfirmed: true,
  },
  IRATA: {
    class: "credential",
    defaultValidityMonths: null,
    issuingBodyHint: "IRATA",
    validitySource: "Enter the date by hand (rope-access cert validity to be confirmed)",
    validityConfirmed: false,
  },
  CSCS: {
    class: "credential",
    defaultValidityMonths: null,
    issuingBodyHint: "CSCS",
    validitySource: "Card validity varies by card type — enter the date by hand",
    validityConfirmed: false,
  },
  NRC: {
    class: "credential",
    defaultValidityMonths: null,
    issuingBodyHint: "National Rigging Certificate scheme",
    validitySource: "Scheme rule not yet confirmed — enter the date by hand",
    validityConfirmed: false,
  },
  BS7909: {
    class: "credential",
    defaultValidityMonths: null,
    issuingBodyHint: "Training provider",
    validitySource: "Validity varies by provider — enter the date by hand",
    validityConfirmed: false,
  },
  "Electrical Safety": {
    class: "credential",
    defaultValidityMonths: null,
    issuingBodyHint: null,
    validitySource: "Generic label, no single scheme — manual entry",
    validityConfirmed: false,
  },
  "Working at Height": {
    class: "credential",
    defaultValidityMonths: null,
    issuingBodyHint: null,
    validitySource: "Generic label — manual entry",
    validityConfirmed: false,
  },
  Other: {
    class: "credential",
    defaultValidityMonths: null,
    issuingBodyHint: null,
    validitySource: "Manual entry",
    validityConfirmed: false,
  },
  "Risk Assessment": {
    class: "job_document",
    defaultValidityMonths: null,
    issuingBodyHint: null,
    validitySource: "Per-job paperwork, does not expire",
    validityConfirmed: false,
  },
  "Method Statement": {
    class: "job_document",
    defaultValidityMonths: null,
    issuingBodyHint: null,
    validitySource: "Per-job paperwork, does not expire",
    validityConfirmed: false,
  },
};

// DBS (criminal-record) and medical/health documents must never be stored in
// this general document store. The controlled DOCUMENT_TYPES don't include them,
// but `Other` + free-text `custom_type_name` is the exposure. These terms are
// matched case-insensitively against custom_type_name at upload (and against
// custom_type_name + original_filename in the one-off production audit).
export const RESTRICTED_DOCUMENT_TERMS = [
  "dbs",
  "disclosure",
  "barring",
  "crb",
  "basic check",
  "enhanced check",
  "medical",
  "fitness to work",
  "occupational health",
  "gp letter",
  "doctor",
] as const;

/** Returns the first restricted term the text contains (case-insensitive), or null. */
export function matchRestrictedDocumentTerm(value: string | null | undefined): string | null {
  if (!value) return null;
  const haystack = value.toLowerCase();
  for (const term of RESTRICTED_DOCUMENT_TERMS) {
    if (haystack.includes(term)) return term;
  }
  return null;
}

// Derived credential status — compute, never store. A stored status goes stale
// the moment the clock moves.
export type CredentialStatus = "valid" | "expiring_soon" | "expired" | "incomplete";

export const EXPIRING_SOON_DAYS = 90;

/**
 * Status of a credential from its expiry date. job_documents don't expire and
 * are always "valid". A credential with no expiry date is "incomplete" (the
 * backlog the backfill campaign works through), within 90 days is
 * "expiring_soon", past is "expired". `now` is injectable for testing.
 */
export function credentialStatus(
  doc: { document_type: DocumentType; expiry_date: string | Date | null | undefined },
  now: Date = new Date()
): CredentialStatus {
  if (DOCUMENT_TYPE_META[doc.document_type].class === "job_document") return "valid";
  if (!doc.expiry_date) return "incomplete";
  const expiry = typeof doc.expiry_date === "string" ? new Date(doc.expiry_date) : doc.expiry_date;
  const daysLeft = Math.ceil((expiry.getTime() - now.getTime()) / 86_400_000);
  if (daysLeft < 0) return "expired";
  if (daysLeft <= EXPIRING_SOON_DAYS) return "expiring_soon";
  return "valid";
}
