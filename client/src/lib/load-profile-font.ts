import { PROFILE_FONTS, type FontKey } from "@shared/profile-fonts";

/**
 * Adds the stylesheet for a profile font to <head>, once. Repeat calls for
 * the same font do nothing, and the link is left in place: several
 * components on one page (picker, preview, profile) may share it.
 */
export function loadProfileFont(key: FontKey): void {
  if (typeof document === "undefined") return;
  const id = `profile-font-${key}`;
  if (document.getElementById(id)) return;
  const link = document.createElement("link");
  link.id = id;
  link.rel = "stylesheet";
  link.href = PROFILE_FONTS[key].url;
  document.head.appendChild(link);
}
