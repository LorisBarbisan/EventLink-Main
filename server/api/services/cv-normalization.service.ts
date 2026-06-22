export interface WorkHistoryEntry {
  jobTitle: string;
  company?: string;
  dates?: string;
  details?: string;
}

export interface EducationEntry {
  qualification: string;
  institution?: string;
  dates?: string;
}

export interface ConfidenceScored<T> {
  value: T;
  confidence: number;
  source: string;
}

export interface NormalizedFields {
  fullName?: ConfidenceScored<string>;
  title?: ConfidenceScored<string>;
  location?: ConfidenceScored<string>;
  country?: ConfidenceScored<string>;
  bio?: ConfidenceScored<string>;
  experienceYears?: ConfidenceScored<number>;
  skills?: ConfidenceScored<string[]>;
  certifications?: ConfidenceScored<string[]>;
  workHistory?: ConfidenceScored<WorkHistoryEntry[]>;
  education?: ConfidenceScored<EducationEntry[]>;
}

const JUNK_VALUES = new Set([
  "n/a",
  "not specified",
  "unknown",
  "not found",
  "none",
  "not available",
  "not provided",
  "not mentioned",
  "omitted",
  "no information",
  "no data",
  "not stated",
  "not given",
  "not applicable",
]);

const FAKE_LOCATIONS = new Set([
  "a single region",
  "single region",
  "multiple locations",
  "various locations",
  "uk and europe",
  "across the uk",
  "nationwide",
  "remote",
  "freelance",
  "available",
  "willing to travel",
  "uk wide",
  "uk-wide",
  "flexible",
  "united kingdom",
  "uk",
  "england",
]);

const TERM_CANON: Record<string, string> = {
  vmix: "vMix",
  grandma: "grandMA",
  grandma2: "grandMA2",
  grandma3: "grandMA3",
  ma2: "MA2",
  ma3: "MA3",
  "foh engineer": "FOH Engineer",
  foh: "FOH",
  iph: "IPH",
  iem: "IEM",
  rf: "RF",
  "avid s3l": "Avid S3L",
  protools: "Pro Tools",
  "pro tools": "Pro Tools",
  qlab: "QLab",
  disguise: "Disguise",
  d3: "d3",
  resolume: "Resolume",
  watchout: "Watchout",
  notch: "Notch",
  catalyst: "Catalyst",
  "pandoras box": "Pandora's Box",
  "barco e2": "Barco E2",
  "led wall": "LED Wall",
  "led walls": "LED Walls",
  "led screen": "LED Screen",
  "led screens": "LED Screens",
  "projection mapping": "Projection Mapping",
  novastar: "NovaStar",
  "nova star": "NovaStar",
  brompton: "Brompton",
  digico: "DiGiCo",
  yamaha: "Yamaha",
  midas: "Midas",
  "allen & heath": "Allen & Heath",
  soundcraft: "Soundcraft",
  dante: "Dante",
  milan: "Milan",
  audinate: "Audinate",
  clearcom: "ClearCom",
  riedel: "Riedel",
  bolero: "Bolero",
  "l-acoustics": "L-Acoustics",
  "d&b": "d&b Audiotechnik",
  turbosound: "Turbosound",
  nexo: "NEXO",
  genelec: "Genelec",
  "meyer sound": "Meyer Sound",
  "etc eos": "ETC Eos",
  chamsys: "ChamSys",
  avolites: "Avolites",
  hog: "Hog",
  "grandma ma2": "grandMA2",
};

const VAGUE_SKILLS = new Set([
  "hard-working",
  "hardworking",
  "motivated",
  "team player",
  "experienced",
  "dedicated",
  "passionate",
  "reliable",
  "flexible",
  "adaptable",
  "good communicator",
  "communication skills",
  "problem solver",
  "attention to detail",
  "self-motivated",
  "proactive",
  "enthusiastic",
]);

export class CvNormalizationService {
  normalizeAll(raw: Record<string, any>): NormalizedFields {
    const result: NormalizedFields = {};

    if (raw.fullName?.value) {
      const v = this.cleanFullName(raw.fullName.value);
      if (v)
        result.fullName = {
          value: v,
          confidence: raw.fullName.confidence ?? 0.8,
          source: raw.fullName.source ?? "header",
        };
    }

    if (raw.title?.value) {
      const v = this.cleanTitle(raw.title.value);
      if (v)
        result.title = {
          value: v,
          confidence: raw.title.confidence ?? 0.75,
          source: raw.title.source ?? "header",
        };
    }

    if (raw.location?.value) {
      const v = this.cleanLocation(raw.location.value);
      if (v)
        result.location = {
          value: v,
          confidence: raw.location.confidence ?? 0.7,
          source: raw.location.source ?? "header",
        };
    }

    if (raw.country?.value && typeof raw.country.value === "string") {
      const v = raw.country.value.trim();
      if (v && !JUNK_VALUES.has(v.toLowerCase())) {
        result.country = {
          value: v,
          confidence: raw.country.confidence ?? 0.75,
          source: raw.country.source ?? "header",
        };
      }
    }

    if (raw.bio?.value) {
      const v = this.cleanBio(raw.bio.value);
      if (v)
        result.bio = {
          value: v,
          confidence: raw.bio.confidence ?? 0.85,
          source: raw.bio.source ?? "summary",
        };
    }

    if (raw.experienceYears?.value) {
      const v = this.cleanExperienceYears(raw.experienceYears.value);
      if (v !== undefined)
        result.experienceYears = {
          value: v,
          confidence: raw.experienceYears.confidence ?? 0.7,
          source: raw.experienceYears.source ?? "summary",
        };
    }

    if (raw.skills?.value) {
      const v = this.cleanSkills(raw.skills.value);
      if (v?.length)
        result.skills = {
          value: v,
          confidence: raw.skills.confidence ?? 0.85,
          source: raw.skills.source ?? "skills",
        };
    }

    if (raw.certifications?.value) {
      const v = this.cleanCertifications(raw.certifications.value);
      if (v?.length)
        result.certifications = {
          value: v,
          confidence: raw.certifications.confidence ?? 0.8,
          source: raw.certifications.source ?? "certifications",
        };
    }

    if (raw.workHistory?.value) {
      const v = this.cleanWorkHistory(raw.workHistory.value);
      if (v?.length)
        result.workHistory = {
          value: v,
          confidence: raw.workHistory.confidence ?? 0.8,
          source: raw.workHistory.source ?? "experience",
        };
    }

    if (raw.education?.value) {
      const v = this.cleanEducation(raw.education.value);
      if (v?.length)
        result.education = {
          value: v,
          confidence: raw.education.confidence ?? 0.8,
          source: raw.education.source ?? "education",
        };
    }

    return result;
  }

  private cleanString(val: any): string | undefined {
    if (!val || typeof val !== "string") return undefined;
    const t = val.trim();
    if (!t || JUNK_VALUES.has(t.toLowerCase())) return undefined;
    return t;
  }

  cleanFullName(val: any): string | undefined {
    const name = this.cleanString(val);
    if (!name) return undefined;
    if (name.includes("@") || /\d{5,}/.test(name) || /curriculum vitae/i.test(name))
      return undefined;
    const words = name.split(/\s+/);
    if (words.length < 1 || words.length > 4) return undefined;
    return name;
  }

  cleanTitle(val: any): string | undefined {
    const title = this.cleanString(val);
    if (!title) return undefined;
    if (title.length > 60) return undefined;
    const words = title.split(/\s+/);
    if (words.length > 8) return undefined;
    const badPrefixes = [
      "in ",
      "for ",
      "the ",
      "a ",
      "an ",
      "this ",
      "with ",
      "and ",
      "to ",
      "of ",
      "experienced",
      "passionate",
      "dedicated",
      "skilled",
      "qualified",
      "highly",
    ];
    if (badPrefixes.some((p) => title.toLowerCase().startsWith(p))) return undefined;
    if ((title.match(/,/g) || []).length > 2) return undefined;
    if (/[.!?]/.test(title)) return undefined;
    return title;
  }

  cleanLocation(val: any): string | undefined {
    const loc = this.cleanString(val);
    if (!loc) return undefined;
    if (FAKE_LOCATIONS.has(loc.toLowerCase())) return undefined;
    const words = loc.split(/\s+/);
    if (words.length > 5) return undefined;
    if (loc.length < 3) return undefined;
    return loc;
  }

  cleanBio(val: any): string | undefined {
    const bio = this.cleanString(val);
    if (!bio) return undefined;
    if (bio.length < 30) return undefined;
    return bio.slice(0, 1500);
  }

  cleanExperienceYears(val: any): number | undefined {
    const n = typeof val === "number" ? val : parseInt(String(val), 10);
    if (isNaN(n) || n < 1 || n > 50) return undefined;
    return n;
  }

  canonicalizeSkill(skill: string): string {
    const lower = skill.toLowerCase().trim();
    if (TERM_CANON[lower]) return TERM_CANON[lower];
    return skill
      .split(/\s+/)
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }

  cleanSkills(val: any): string[] | undefined {
    if (!Array.isArray(val) || val.length === 0) return undefined;
    const seen = new Set<string>();
    const result: string[] = [];
    for (const s of val) {
      if (typeof s !== "string") continue;
      const trimmed = s.trim();
      if (!trimmed || trimmed.length > 50) continue;
      if (VAGUE_SKILLS.has(trimmed.toLowerCase())) continue;
      const canonical = this.canonicalizeSkill(trimmed);
      const key = canonical.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(canonical);
    }
    return result.length > 0 ? result : undefined;
  }

  cleanCertifications(val: any): string[] | undefined {
    if (!Array.isArray(val) || val.length === 0) return undefined;
    const seen = new Set<string>();
    const result: string[] = [];
    for (const c of val) {
      if (typeof c !== "string") continue;
      const trimmed = c.trim();
      if (!trimmed || trimmed.length < 2 || trimmed.length > 80) continue;
      const key = trimmed.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      result.push(trimmed);
    }
    return result.length > 0 ? result : undefined;
  }

  cleanWorkHistory(val: any): WorkHistoryEntry[] | undefined {
    if (!Array.isArray(val) || val.length === 0) return undefined;
    const result: WorkHistoryEntry[] = [];
    for (const entry of val) {
      if (typeof entry !== "object" || !entry) continue;
      const jobTitle = this.cleanString(entry.jobTitle || entry.title);
      if (!jobTitle) continue;
      const item: WorkHistoryEntry = { jobTitle };
      const company = this.cleanString(entry.company);
      if (company) item.company = company;
      const dates = this.cleanString(entry.dates);
      if (dates) item.dates = dates;
      const details = this.cleanString(entry.details || entry.description);
      if (details) item.details = details.slice(0, 500);
      result.push(item);
    }
    return result.length > 0 ? result : undefined;
  }

  cleanEducation(val: any): EducationEntry[] | undefined {
    if (!Array.isArray(val) || val.length === 0) return undefined;
    const result: EducationEntry[] = [];
    for (const entry of val) {
      if (typeof entry !== "object" && typeof entry !== "string") continue;
      if (typeof entry === "string") {
        const q = this.cleanString(entry);
        if (q && q.length > 5) result.push({ qualification: q });
        continue;
      }
      const qualification = this.cleanString(entry.qualification || entry.degree || entry.title);
      if (!qualification) continue;
      const item: EducationEntry = { qualification };
      const institution = this.cleanString(entry.institution || entry.school || entry.university);
      if (institution) item.institution = institution;
      const dates = this.cleanString(entry.dates || entry.years);
      if (dates) item.dates = dates;
      result.push(item);
    }
    return result.length > 0 ? result : undefined;
  }
}

export const cvNormalizationService = new CvNormalizationService();
