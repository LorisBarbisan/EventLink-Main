import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";

export type FontKey = "inter" | "playfair" | "poppins" | "space-grotesk";

export interface ProfileTheme {
  accent?: string;
  font?: FontKey;
  section_order?: string[];
}

const ACCENT_PRESETS = [
  { label: "Orange", value: "#f97316" },
  { label: "Purple", value: "#8b5cf6" },
  { label: "Blue", value: "#3b82f6" },
  { label: "Teal", value: "#14b8a6" },
  { label: "Rose", value: "#f43f5e" },
  { label: "Amber", value: "#f59e0b" },
  { label: "Emerald", value: "#10b981" },
  { label: "Slate", value: "#64748b" },
];

const FONTS: { key: FontKey; label: string; sample: string; style: string }[] = [
  {
    key: "inter",
    label: "Modern",
    sample: "Clean & professional",
    style: "font-sans",
  },
  {
    key: "playfair",
    label: "Elegant",
    sample: "Editorial & refined",
    style: "font-serif",
  },
  {
    key: "poppins",
    label: "Friendly",
    sample: "Rounded & approachable",
    style: "",
  },
  {
    key: "space-grotesk",
    label: "Technical",
    sample: "Distinct & modern",
    style: "",
  },
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

  const setAccent = (v: string) => onChange({ ...theme, accent: v });
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
        <p className="mb-2 text-sm font-medium">Accent colour</p>
        {/* v2 */}
        <div className="flex flex-wrap gap-2">
          {ACCENT_PRESETS.map((p) => (
            <button
              key={p.value}
              type="button"
              title={p.label}
              onClick={() => setAccent(p.value)}
              className={cn(
                "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                accent === p.value ? "scale-110 border-foreground" : "border-transparent"
              )}
              style={{ backgroundColor: p.value }}
            />
          ))}
          {/* Custom hex */}
          <label className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full border-2 border-dashed border-border text-xs text-muted-foreground hover:border-foreground">
            <input
              type="color"
              value={accent}
              onChange={(e) => setAccent(e.target.value)}
              className="sr-only"
            />
            +
          </label>
        </div>
        <div
          className="mt-2 h-1.5 w-full rounded-full"
          style={{ backgroundColor: accent, opacity: 0.7 }}
        />
      </div>

      {/* Font */}
      <div>
        <p className="mb-2 text-sm font-medium">Font</p>
        <div className="grid grid-cols-2 gap-2">
          {FONTS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFont(f.key)}
              className={cn(
                "rounded-lg border-2 px-3 py-2 text-left transition-colors",
                font === f.key
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50"
              )}
              style={{ fontFamily: FONT_CSS[f.key] }}
            >
              <span className="block text-sm font-semibold">{f.label}</span>
              <span className="block text-xs text-muted-foreground">{f.sample}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Section order */}
      <div>
        <p className="mb-2 text-sm font-medium">Section order</p>
        <div className="space-y-1">
          {sections.map((s, i) => (
            <div
              key={s}
              className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-1.5"
            >
              <span className="flex-1 text-sm">{SECTION_LABELS[s] ?? s}</span>
              <button
                type="button"
                onClick={() => moveSection(i, -1)}
                disabled={i === 0}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
              >
                <ChevronUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => moveSection(i, 1)}
                disabled={i === sections.length - 1}
                className="text-muted-foreground hover:text-foreground disabled:opacity-30"
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
