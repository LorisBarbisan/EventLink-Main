/**
 * The fonts a freelancer can pick for their public profile and card.
 *
 * The one place these live. The picker, the profile page, the card and the
 * card preview all read from here, so a face can't be one thing on the
 * profile and another on the card.
 *
 * The site itself is Arial (tailwind.config.ts) and loads no web fonts, so
 * every face here needs its stylesheet loaded before it renders. A stack
 * without a loaded face silently falls back to Arial.
 */

export type FontKey = "inter" | "playfair" | "poppins" | "space-grotesk";

export interface ProfileFont {
  /** The mood word shown in the picker. */
  label: string;
  /** The typeface's own name, shown under the label. */
  family: string;
  /** CSS font-family stack. */
  stack: string;
  /** Google Fonts stylesheet for the face. */
  url: string;
}

const gf = (family: string, weights: string) =>
  `https://fonts.googleapis.com/css2?family=${family}:wght@${weights}&display=swap`;

export const PROFILE_FONTS: Record<FontKey, ProfileFont> = {
  inter: {
    label: "Modern",
    family: "Inter",
    stack: "Inter, sans-serif",
    url: gf("Inter", "400;500;600;700"),
  },
  playfair: {
    label: "Elegant",
    family: "Playfair Display",
    stack: "'Playfair Display', serif",
    url: gf("Playfair+Display", "400;600;700"),
  },
  poppins: {
    label: "Friendly",
    family: "Poppins",
    stack: "Poppins, sans-serif",
    url: gf("Poppins", "400;500;600;700"),
  },
  "space-grotesk": {
    label: "Technical",
    family: "Space Grotesk",
    stack: "'Space Grotesk', sans-serif",
    url: gf("Space+Grotesk", "400;500;600;700"),
  },
};

export const FONT_KEYS = Object.keys(PROFILE_FONTS) as FontKey[];
export const DEFAULT_FONT: FontKey = "inter";

export function isFontKey(v: unknown): v is FontKey {
  return typeof v === "string" && Object.prototype.hasOwnProperty.call(PROFILE_FONTS, v);
}

/**
 * The font for a stored theme value. Anything missing or unknown (an old or
 * retired key) resolves to the default, never to `undefined`.
 */
export function profileFont(v: unknown): ProfileFont {
  return PROFILE_FONTS[isFontKey(v) ? v : DEFAULT_FONT];
}
