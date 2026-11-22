import { loadProfileFont } from "@/lib/load-profile-font";
import { cn } from "@/lib/utils";
import { FONT_KEYS, PROFILE_FONTS, profileFont, type FontKey } from "@shared/profile-fonts";
import { reconcileSectionOrder, SECTION_LABELS } from "@shared/profile-sections";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useEffect } from "react";

export type { FontKey };
export type TextureKey = "none" | "leather" | "grid";

export interface ProfileTheme {
  accent?: string;
  button_color?: string;
  button_text?: "auto" | "light" | "dark";
  font?: FontKey;
  section_order?: string[];
  texture?: TextureKey;
}

interface Template {
  label: string;
  accent: string;
  button_color: string;
  button_text: "auto" | "light" | "dark";
  font: FontKey;
  texture: TextureKey;
}

const TEMPLATES: Template[] = [
  {
    label: "Corporate",
    accent: "#0F2C59",
    button_color: "#FFFFFF",
    button_text: "dark",
    font: "inter",
    texture: "none",
  },
  {
    label: "Tech",
    accent: "#3A4750",
    button_color: "#00ADB5",
    button_text: "dark",
    font: "space-grotesk",
    texture: "grid",
  },
  {
    label: "Creative",
    accent: "#222831",
    button_color: "#F9B208",
    button_text: "dark",
    font: "poppins",
    texture: "none",
  },
  {
    label: "Wellness",
    accent: "#1A4314",
    button_color: "#F5F2E7",
    button_text: "dark",
    font: "inter",
    texture: "none",
  },
  {
    label: "Luxury",
    accent: "#3B1E30",
    button_color: "#D4AF37",
    button_text: "dark",
    font: "playfair",
    texture: "none",
  },
];

interface Props {
  theme: ProfileTheme;
  onChange: (theme: ProfileTheme) => void;
  /** Whether the freelancer shows their calendar publicly. The Calendar tab only appears when they do. */
  calendarPublic?: boolean;
  /** Turns public calendar visibility on (the same setting as "Show my calendar"). */
  onMakeCalendarPublic?: () => void;
  calendarPending?: boolean;
}

export function ProfileThemePicker({
  theme,
  onChange,
  calendarPublic = false,
  onMakeCalendarPublic,
  calendarPending = false,
}: Props) {
  const accent = theme.accent ?? "#f97316";
  const font = theme.font ?? "inter";
  const sections = reconcileSectionOrder(theme.section_order);

  // The panel exists to compare faces, so load all of them, not just the
  // chosen one. The site loads no web fonts, so without this every sans
  // option renders as Arial.
  useEffect(() => {
    FONT_KEYS.forEach(loadProfileFont);
  }, []);

  const buttonColor = theme.button_color ?? "#ffffff";
  const buttonText = theme.button_text ?? "auto";
  const setAccent = (v: string) => onChange({ ...theme, accent: v });
  const setButtonColor = (v: string) => onChange({ ...theme, button_color: v });
  const setButtonText = (v: "auto" | "light" | "dark") => onChange({ ...theme, button_text: v });
  const setFont = (v: FontKey) => onChange({ ...theme, font: v });

  const applyTemplate = (t: Template) => {
    onChange({
      ...theme,
      accent: t.accent,
      button_color: t.button_color,
      button_text: t.button_text,
      font: t.font,
      texture: t.texture,
    });
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    const next = [...sections];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ ...theme, section_order: next });
  };

  // Texture CSS patterns (SVG data URIs)
  const TEXTURE_BG: Record<TextureKey, string> = {
    none: "none",
    leather:
      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24'%3E%3Cpath d='M12 0L24 12L12 24L0 12Z' fill='none' stroke='rgba(255,255,255,0.07)' stroke-width='0.8'/%3E%3C/svg%3E\")",
    grid: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='40' height='40'%3E%3Cline x1='0' y1='0' x2='0' y2='40' stroke='rgba(0,212,255,0.14)' stroke-width='0.5'/%3E%3Cline x1='0' y1='0' x2='40' y2='0' stroke='rgba(0,212,255,0.14)' stroke-width='0.5'/%3E%3C/svg%3E\")",
  };

  return (
    <div className="space-y-6">
      {/* Templates */}
      <div>
        <p className="mb-3 text-sm font-semibold">Templates</p>
        <div className="grid grid-cols-5 gap-2">
          {TEMPLATES.map((t) => (
            <button
              key={t.label}
              type="button"
              onClick={() => applyTemplate(t)}
              title={t.label}
              className={cn(
                "group flex flex-col items-center gap-1.5 rounded-xl border-2 p-1.5 transition-all hover:border-foreground/60",
                theme.accent === t.accent && theme.texture === t.texture
                  ? "border-foreground ring-2 ring-foreground/20"
                  : "border-border"
              )}
            >
              {/* Mini card preview */}
              <div
                className="h-12 w-full rounded-lg"
                style={{
                  backgroundColor: t.accent,
                  backgroundImage: TEXTURE_BG[t.texture],
                  border: t.accent === "#ffffff" ? "1px solid #e5e7eb" : "none",
                }}
              >
                {/* Mini button swatch */}
                <div className="flex h-full items-end justify-center pb-1.5">
                  <div
                    className="h-1.5 w-8 rounded-full"
                    style={{ backgroundColor: t.button_color }}
                  />
                </div>
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Background colour */}
      <div>
        <p className="mb-1 text-sm font-semibold">Background colour</p>
        <p className="mb-3 text-xs text-muted-foreground">Card background colour.</p>
        <div className="flex items-center gap-2">
          <label
            htmlFor="profilethemepicker-label-classname-182"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border shadow-sm"
            style={{ backgroundColor: accent }}
          >
            <span className="sr-only">Accent colour</span>
            <input
              id="profilethemepicker-label-classname-182"
              type="color"
              aria-label="Accent colour"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="sr-only"
            />
          </label>
          <input
            type="text"
            value={accent}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setAccent(v);
            }}
            className="h-7 w-24 rounded-md border border-border bg-background px-2 font-mono text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Button colour */}
      <div>
        <p className="mb-1 text-sm font-semibold">Button colour</p>
        <p className="mb-3 text-xs text-muted-foreground">
          Colour of the section buttons on the back of your card.
        </p>
        <div className="flex items-center gap-2">
          <label
            htmlFor="profilethemepicker-label-classname-212"
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border shadow-sm"
            style={{ backgroundColor: buttonColor }}
          >
            <span className="sr-only">Button colour</span>
            <input
              id="profilethemepicker-label-classname-212"
              type="color"
              value={buttonColor}
              onChange={(e) => setButtonColor(e.target.value)}
              className="sr-only"
            />
          </label>
          <input
            type="text"
            value={buttonColor}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) setButtonColor(v);
            }}
            className="h-7 w-24 rounded-md border border-border bg-background px-2 font-mono text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        {/* Button text colour toggle */}
        <div className="mt-3">
          <p className="mb-2 text-xs font-semibold text-muted-foreground">Button text</p>
          <div className="flex gap-1">
            {(["auto", "light", "dark"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setButtonText(opt)}
                className={cn(
                  "rounded-md border px-3 py-1 text-xs font-medium capitalize transition-all",
                  buttonText === opt
                    ? "border-foreground bg-foreground text-background"
                    : "border-border bg-background text-muted-foreground hover:border-foreground/40"
                )}
              >
                {opt === "auto" ? "Auto" : opt === "light" ? "☀ Light" : "☾ Dark"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Font */}
      <div>
        <p className="mb-3 text-sm font-semibold">Profile font</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {FONT_KEYS.map((key) => {
            const f = PROFILE_FONTS[key];
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFont(key)}
                className={cn(
                  "flex flex-col items-start rounded-xl border-2 px-3 py-3 transition-all",
                  font === key
                    ? "border-foreground bg-muted/60"
                    : "border-border bg-background hover:border-foreground/40"
                )}
                style={{ fontFamily: f.stack }}
              >
                <span className="text-xl font-semibold leading-none">Aa</span>
                <span className="mt-1 text-xs text-muted-foreground">{f.label}</span>
                <span className="text-[10px] text-muted-foreground/70">{f.family}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Section order */}
      <div>
        <p className="mb-1 text-sm font-semibold">Section order</p>
        <p className="mb-3 text-xs text-muted-foreground">
          This controls the order of tabs on your public profile.
        </p>
        <div className="space-y-1.5">
          {sections.map((s, i) => {
            const hidden = s === "calendar" && !calendarPublic;
            return (
              <div
                key={s}
                className={cn(
                  "flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2",
                  hidden && "border-dashed"
                )}
              >
                <span className={cn("flex-1 text-sm", hidden && "text-muted-foreground")}>
                  {SECTION_LABELS[s]}
                  {hidden && (
                    <span className="mt-0.5 block text-xs">
                      Shown only when your calendar is public.
                      {onMakeCalendarPublic && (
                        <>
                          {" "}
                          <button
                            type="button"
                            onClick={onMakeCalendarPublic}
                            disabled={calendarPending}
                            className="underline underline-offset-2 hover:text-foreground disabled:opacity-50"
                          >
                            Show my calendar
                          </button>
                        </>
                      )}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => moveSection(i, -1)}
                  disabled={i === 0}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                >
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => moveSection(i, 1)}
                  disabled={i === sections.length - 1}
                  className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Returns a <style> tag string to inject into any page for the given theme. */
export function themeToCSS(theme: ProfileTheme): string {
  const accent = theme.accent ?? "#f97316";
  const font = profileFont(theme.font).stack;
  return `
    :root {
      --profile-accent: ${accent};
      --profile-font: ${font};
    }
  `;
}
