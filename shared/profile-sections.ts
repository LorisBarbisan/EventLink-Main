/**
 * The tabs on a freelancer's public profile, and the order they choose for
 * them in the appearance picker ("Section order").
 *
 * The card (FreelancerCard) has its own, different set of sections and does
 * not read this order.
 */

export type ProfileSection = "about" | "references" | "documents" | "contacts" | "calendar";

export const DEFAULT_SECTIONS: readonly ProfileSection[] = [
  "about",
  "references",
  "documents",
  "contacts",
  "calendar",
];

export const SECTION_LABELS: Record<ProfileSection, string> = {
  about: "About",
  references: "References",
  documents: "Documents",
  contacts: "Contacts",
  calendar: "Calendar",
};

function isSection(v: unknown): v is ProfileSection {
  return typeof v === "string" && (DEFAULT_SECTIONS as readonly string[]).includes(v);
}

/**
 * The full section order for a stored `section_order`.
 *
 * Profiles saved before a section existed (every profile saved before
 * Calendar joined the list has four entries) keep their order, with the
 * missing sections appended in default order. Without this, saving a
 * reorder would write the short list back and the new section would be
 * gone for good. Unknown and duplicate entries are dropped.
 */
export function reconcileSectionOrder(stored: unknown): ProfileSection[] {
  const kept: ProfileSection[] = [];
  if (Array.isArray(stored)) {
    for (const s of stored) {
      if (isSection(s) && !kept.includes(s)) kept.push(s);
    }
  }
  return [...kept, ...DEFAULT_SECTIONS.filter((s) => !kept.includes(s))];
}
