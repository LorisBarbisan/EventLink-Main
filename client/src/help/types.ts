// ============================================================
// Contextual help system — content model (client).
// Help content is DATA, not markup. Components declare an identity (a key);
// content is looked up from this registry by that key.
// ============================================================

export type HelpScope = "field" | "action" | "feature" | "page";

export type HelpAudience = "freelancer" | "recruiter" | "admin";

/** Minimal app state a `showWhen` predicate can read. */
export interface HelpContext {
  role?: HelpAudience;
  tier?: "free" | "pro";
  route?: string;
}

export interface HelpEntry {
  /** Stable dotted key. Never reused, never renamed — a rename is a new key. */
  key: string;
  scope: HelpScope;
  /** Optional bold first line. Omit for short field hints. */
  title?: string;
  /** One sentence. See the copy rules in the epic (section 8). */
  body: string;
  learnMoreHref?: string;
  /** Restrict by role; omit for everyone. */
  audience?: HelpAudience[];
  /** Restrict by tier — e.g. Pro-only features. */
  tier?: "free" | "pro";
  /** Discovery layer only: how many page visits before this may fire. */
  minVisits?: number;
  maxVisits?: number;
  /** Discovery layer only: higher wins when several are eligible. */
  priority?: number;
  /** Discovery layer only: show once ever, then never again. */
  oncePerUser?: boolean;
  /** Arbitrary predicate against app state — e.g. profile incomplete. */
  showWhen?: (ctx: HelpContext) => boolean;
  /** Bump to re-show after a meaningful copy change. */
  version: number;
}

/** Per-key interaction state, hydrated from localStorage then the server. */
export interface HelpKeyState {
  seenCount: number;
  lastSeenAt?: string | null;
  dismissedCount: number;
  dismissedAt?: string | null;
  completedAt?: string | null;
  contentVersion: number;
}

export type HelpMode = "full" | "hover_only" | "off";

/** Admin copy override row (merged over the registry, override winning). */
export interface HelpOverride {
  key: string;
  title?: string | null;
  body?: string | null;
  learn_more_href?: string | null;
  version: number;
}
