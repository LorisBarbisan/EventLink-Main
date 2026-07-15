import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

export type FontKey = "inter" | "playfair" | "poppins" | "space-grotesk";

export interface ProfileTheme {
  accent?: string;
  button_color?: string;
  font?: FontKey;
  section_order?: string[];
}

const ACCENT_PRESETS = [
  { label: "Orange", value: "#f97316" },
  { label: "Brown", value: "#92400e" },
  { label: "Teal", value: "#0d7490" },
  { label: "Green", value: "#15803d" },
  { label: "Taupe", value: "#78716c" },
  { label: "Amber", value: "#ca8a04" },
  { label: "Purple", value: "#7c3aed" },
  { label: "Rose", value: "#be185d" },
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
  const setAccent = (v: string) => onChange({ ...theme, accent: v });
  const setButtonColor = (v: string) => onChange({ ...theme, button_color: v });
  const setFont = (v: FontKey) => onChange({ ...theme, font: v });

  const moveSection = (idx: number, dir: -1 | 1) => {
    const next = [...sections];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ ...theme, section_order: next });
  };

  return (
    <div className="space-y-6">
      {/* Accent colour */}
      <div>
        <p className="mb-3 text-sm font-semibold">Accent colour</p>
        <div className="flex flex-wrap gap-2">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              title={p.label}
              onClick={() => setAccent(p.value)}
              className={cn(
                "h-8 w-14 rounded-full border-2 transition-all hover:scale-105",
                accent === p.value
                  ? "scale-105 border-foreground ring-2 ring-foreground/20"
                  : "border-transparent hover:border-foreground/30"
              )}
              style={{ backgroundColor: p.value }}
            >
              {accent === p.value && (
                <span className="block text-center text-xs font-bold text-white drop-shadow">
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
        {/* Custom hex */}
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Custom</span>
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
        <div className="flex flex-wrap gap-2">
          {[
            { label: "White", value: "#ffffff" },
            { label: "Light", value: "#f5f0eb" },
            { label: "Orange", value: "#f97316" },
            { label: "Amber", value: "#fbbf24" },
            { label: "Teal", value: "#0d9488" },
            { label: "Dark", value: "#1e293b" },
          ].map((p) => (
            <button
              key={p.value}
              type="button"
              title={p.label}
              onClick={() => setButtonColor(p.value)}
              className={cn(
                "h-8 w-14 rounded-full border-2 transition-all hover:scale-105",
                buttonColor === p.value
                  ? "scale-105 border-foreground ring-2 ring-foreground/20"
                  : "border-border hover:border-foreground/30"
              )}
              style={{ backgroundColor: p.value }}
            >
              {buttonColor === p.value && (
                <span
                  className="block text-center text-xs font-bold drop-shadow"
                  style={{
                    color:
                      p.value === "#ffffff" || p.value === "#f5f0eb" || p.value === "#fbbf24"
                        ? "#333"
                        : "#fff",
                  }}
                >
                  ✓
                </span>
              )}
            </button>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Custom</span>
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
