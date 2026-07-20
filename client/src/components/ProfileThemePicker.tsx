import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

export type FontKey = "inter" | "playfair" | "poppins" | "space-grotesk";
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

const FONTS: { key: FontKey; label: string; style: string }[] = [
  { key: "inter", label: "Modern", style: "Inter, sans-serif" },
  { key: "playfair", label: "Elegant", style: "'Playfair Display', serif" },
  { key: "poppins", label: "Friendly", style: "Poppins, sans-serif" },
  { key: "space-grotesk", label: "Technical", style: "'Space Grotesk', sans-serif" },
];

const FONT_CSS: Record<FontKey, string> = {
  inter: "Inter, sans-serif",
  playfair: "'Playfair Display', serif",
  poppins: "Poppins, sans-serif",
  "space-grotesk": "'Space Grotesk', sans-serif",
};

const DEFAULT_SECTIONS = ["about", "portfolio", "references", "documents", "contacts"];

const SECTION_LABELS: Record<string, string> = {
  about: "About",
  portfolio: "Portfolio",
  references: "References",
  documents: "Documents",
  contacts: "Contacts",
};

interface Props {
  theme: ProfileTheme;
  onChange: (theme: ProfileTheme) => void;
}

export function ProfileThemePicker({ theme, onChange }: Props) {
  const accent = theme.accent ?? "#f97316";
  const font = theme.font ?? "inter";
  const sections = theme.section_order ?? DEFAULT_SECTIONS;

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
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border shadow-sm"
            style={{ backgroundColor: accent }}
          >
            <input
              type="color"
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
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md border border-border shadow-sm"
            style={{ backgroundColor: buttonColor }}
          >
            <input
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
          {FONTS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFont(f.key)}
              className={cn(
                "flex flex-col items-start rounded-xl border-2 px-3 py-3 transition-all",
                font === f.key
                  ? "border-foreground bg-muted/60"
                  : "border-border bg-background hover:border-foreground/40"
              )}
              style={{ fontFamily: f.style }}
            >
              <span className="text-xl font-semibold leading-none">Aa</span>
              <span
                className="mt-1 text-xs text-muted-foreground"
                style={{ fontFamily: "Inter, sans-serif" }}
              >
                {f.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Section order */}
      <div>
        <p className="mb-1 text-sm font-semibold">Section order</p>
        <p className="mb-3 text-xs text-muted-foreground">
          This controls the order of tabs on your public profile.
        </p>
        <div className="space-y-1.5">
          {sections.map((s, i) => (
            <div
              key={s}
              className="flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2"
            >
              <span className="flex-1 text-sm">{SECTION_LABELS[s] ?? s}</span>
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
          ))}
        </div>
      </div>
    </div>
  );
}

/** Returns a <style> tag string to inject into any page for the given theme. */
export function themeToCSS(theme: ProfileTheme): string {
  const accent = theme.accent ?? "#f97316";
  const font = FONT_CSS[theme.font ?? "inter"];
  return `
    :root {
      --profile-accent: ${accent};
      --profile-font: ${font};
    }
  `;
}

/** Google Fonts URL for the chosen font (returns null for inter which is already loaded). */
export function fontGoogleUrl(font: FontKey): string | null {
  const map: Partial<Record<FontKey, string>> = {
    playfair:
      "https://fonts.googleapis.com/css2?family=Playfair+Display:wght@400;600;700&display=swap",
    poppins: "https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap",
    "space-grotesk":
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap",
  };
  return map[font] ?? null;
}

export { DEFAULT_SECTIONS, FONT_CSS };
