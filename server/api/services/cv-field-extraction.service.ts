import OpenAI from "openai";
import type { SectionBlocks } from "./cv-section-detection.service";
import type { WorkHistoryEntry, EducationEntry } from "./cv-normalization.service";

export interface RawFieldResult {
  fullName?: { value: string; confidence: number; source: string };
  title?: { value: string; confidence: number; source: string };
  location?: { value: string; confidence: number; source: string };
  bio?: { value: string; confidence: number; source: string };
  experienceYears?: { value: number; confidence: number; source: string };
  skills?: { value: string[]; confidence: number; source: string };
  certifications?: { value: string[]; confidence: number; source: string };
  workHistory?: { value: WorkHistoryEntry[]; confidence: number; source: string };
  education?: { value: EducationEntry[]; confidence: number; source: string };
}

let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    openaiClient = new OpenAI({
      apiKey,
      // baseURL only needed for Replit's AI proxy in dev; undefined = standard OpenAI endpoint
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
    });
  }
  return openaiClient;
}

async function callAI(systemPrompt: string, userPrompt: string, label: string): Promise<any> {
  const response = await getOpenAIClient().chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    response_format: { type: "json_object" },
    max_completion_tokens: 2000,
    temperature: 0.0,
  });
  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error(`No response from AI for ${label}`);
  console.log(`🤖 [${label}] raw: ${content.substring(0, 300)}`);
  return JSON.parse(content);
}

export class CvFieldExtractionService {
  async extractAllFields(sections: SectionBlocks, fullText: string): Promise<RawFieldResult> {
    const [identity, skillsAndCerts, workHistory, education] = await Promise.allSettled([
      this.extractIdentity(sections),
      this.extractSkillsAndCertifications(sections, fullText),
      this.extractWorkHistory(sections),
      this.extractEducation(sections),
    ]);

    const result: RawFieldResult = {};

    if (identity.status === "fulfilled") {
      Object.assign(result, identity.value);
    } else {
      console.warn("⚠️ Identity extraction failed:", identity.reason);
    }

    if (skillsAndCerts.status === "fulfilled") {
      if (skillsAndCerts.value.skills) result.skills = skillsAndCerts.value.skills;
      if (skillsAndCerts.value.certifications) result.certifications = skillsAndCerts.value.certifications;
    } else {
      console.warn("⚠️ Skills/certs extraction failed:", skillsAndCerts.reason);
    }

    if (workHistory.status === "fulfilled" && workHistory.value) {
      result.workHistory = workHistory.value;
    } else if (workHistory.status === "rejected") {
      console.warn("⚠️ Work history extraction failed:", workHistory.reason);
    }

    if (education.status === "fulfilled" && education.value) {
      result.education = education.value;
    } else if (education.status === "rejected") {
      console.warn("⚠️ Education extraction failed:", education.reason);
    }

    return result;
  }

  // ── Prompt 2: Identity ───────────────────────────────────────────────────────

  private async extractIdentity(sections: SectionBlocks): Promise<Partial<RawFieldResult>> {
    const inputText = [sections.headerBlock, sections.summaryBlock]
      .filter(Boolean)
      .join("\n\n---\n\n")
      .substring(0, 3000);

    if (!inputText.trim()) return {};

    const system = `You are a structured data extractor. Extract personal identity information from CV text. Return ONLY valid JSON. Never invent data. Omit any field you are not confident about.`;

    const prompt = `Extract identity fields from this CV header and summary text.

Return a JSON object with these fields (omit any field you are not confident about):
- fullName: person's full name (1-4 words, no email/phone/address)
- title: professional job title (1-6 words, title case, must read like a job title — NOT a sentence)
- location: where they are based (specific UK place only — reject vague values like "UK-wide", "nationwide", "remote")
- bio: exact profile summary text (copy verbatim if a clearly written profile/about/summary section exists)
- experienceYears: total years of experience as a number ONLY if explicitly stated (e.g. "8 years experience")

Examples of GOOD titles: "AV Technician", "Sound Engineer", "FOH Engineer", "Technical Director", "Stage Manager"
Examples of BAD titles: "in the planning and execution of events", "Experienced professional with 10 years", "Audio, Visual, Technical Event Production"

Return this structure:
{
  "fullName": { "value": "Jane Smith", "confidence": 0.95, "source": "headerBlock" },
  "title": { "value": "FOH Engineer", "confidence": 0.9, "source": "headerBlock" },
  "location": { "value": "Manchester", "confidence": 0.85, "source": "headerBlock" },
  "bio": { "value": "...", "confidence": 0.9, "source": "summaryBlock" },
  "experienceYears": { "value": 8, "confidence": 0.8, "source": "summaryBlock" }
}

TEXT:
${inputText}`;

    const parsed = await callAI(system, prompt, "Identity");
    const result: Partial<RawFieldResult> = {};

    for (const field of ["fullName", "title", "location", "bio"] as const) {
      if (parsed[field]?.value && typeof parsed[field].value === "string") {
        result[field] = {
          value: parsed[field].value,
          confidence: typeof parsed[field].confidence === "number" ? parsed[field].confidence : 0.75,
          source: parsed[field].source || "header",
        };
      }
    }

    if (parsed.experienceYears?.value != null) {
      const n = Number(parsed.experienceYears.value);
      if (!isNaN(n) && n >= 1 && n <= 50) {
        result.experienceYears = {
          value: n,
          confidence: typeof parsed.experienceYears.confidence === "number" ? parsed.experienceYears.confidence : 0.7,
          source: parsed.experienceYears.source || "summary",
        };
      }
    }

    return result;
  }

  // ── Prompt 3: Skills and certifications ─────────────────────────────────────

  private async extractSkillsAndCertifications(
    sections: SectionBlocks,
    fullText: string
  ): Promise<Partial<RawFieldResult>> {
    const inputText = [sections.skillsBlock, sections.certificationsBlock, sections.additionalBlock]
      .filter(Boolean)
      .join("\n\n---\n\n")
      .substring(0, 4000);

    const combinedInput = inputText || fullText.substring(0, 4000);
    if (!combinedInput.trim()) return {};

    const system = `You are a technical CV parser specialising in the live events industry. Extract skills and certifications accurately. Return ONLY valid JSON. Never invent data.`;

    const prompt = `Extract skills and certifications from this CV text. This is a live events / AV industry CV.

Return a JSON object:
{
  "skills": {
    "value": ["vMix", "DiGiCo SD7", "QLab", "Dante", "LED Walls", "Projection Mapping"],
    "confidence": 0.9,
    "source": "skillsBlock"
  },
  "certifications": {
    "value": ["IPAF", "First Aid at Work", "BS7909", "Dante Level 2"],
    "confidence": 0.85,
    "source": "certificationsBlock"
  }
}

Skills rules:
- Include equipment brands/models, software, technical methods (e.g. "vMix", "DiGiCo SD7", "QLab", "Dante", "LED Walls", "Projection Mapping", "RF Systems", "Allen & Heath dLive")
- Each skill: 1-5 words maximum
- EXCLUDE vague traits: "hard-working", "motivated", "team player", "experienced", "good communicator"
- EXCLUDE certifications (those go in certifications field)

Certifications rules:
- Only formal qualifications, licences: IPAF, PASMA, SIA, DBS, BS7909, First Aid, IOSH, NEBOSH, NVQ, BTEC, ECS, PLI, driving licences, Dante levels
- Do NOT include general skills here
- Omit if none found

TEXT:
${combinedInput}`;

    const parsed = await callAI(system, prompt, "Skills/Certs");
    const result: Partial<RawFieldResult> = {};

    if (parsed.skills?.value && Array.isArray(parsed.skills.value)) {
      result.skills = {
        value: parsed.skills.value.filter((s: any) => typeof s === "string"),
        confidence: typeof parsed.skills.confidence === "number" ? parsed.skills.confidence : 0.85,
        source: parsed.skills.source || "skillsBlock",
      };
    }

    if (parsed.certifications?.value && Array.isArray(parsed.certifications.value)) {
      result.certifications = {
        value: parsed.certifications.value.filter((c: any) => typeof c === "string"),
        confidence: typeof parsed.certifications.confidence === "number" ? parsed.certifications.confidence : 0.8,
        source: parsed.certifications.source || "certificationsBlock",
      };
    }

    return result;
  }

  // ── Prompt 4: Work history ───────────────────────────────────────────────────

  private async extractWorkHistory(
    sections: SectionBlocks
  ): Promise<RawFieldResult["workHistory"] | null> {
    const inputText = sections.experienceBlock.substring(0, 5000);
    if (!inputText.trim()) return null;

    const system = `You are a structured CV parser. Extract work history entries as structured JSON. Return ONLY valid JSON. Never invent data.`;

    const prompt = `Extract all work history entries from this experience section.

Return:
{
  "workHistory": {
    "value": [
      {
        "jobTitle": "AV Technician",
        "company": "Live Nation",
        "dates": "2020 - Present",
        "details": "Delivered AV support for conferences and live events."
      }
    ],
    "confidence": 0.85,
    "source": "experienceBlock"
  }
}

Rules:
- Each entry must have at minimum a jobTitle
- dates: copy as written from the CV (e.g. "Jan 2021 – Mar 2023", "2019 – Present")
- details: copy relevant responsibilities/description text (max 400 chars per entry)
- If a role is listed without a company, use "Freelance" as the company
- Omit sub-fields (company, dates, details) if not present
- Return an empty array if no structured work history is found

EXPERIENCE TEXT:
${inputText}`;

    const parsed = await callAI(system, prompt, "WorkHistory");
    if (!parsed.workHistory?.value || !Array.isArray(parsed.workHistory.value)) return null;

    return {
      value: parsed.workHistory.value as WorkHistoryEntry[],
      confidence: typeof parsed.workHistory.confidence === "number" ? parsed.workHistory.confidence : 0.8,
      source: parsed.workHistory.source || "experienceBlock",
    };
  }

  // ── Prompt 5: Education ──────────────────────────────────────────────────────

  private async extractEducation(
    sections: SectionBlocks
  ): Promise<RawFieldResult["education"] | null> {
    const inputText = sections.educationBlock.substring(0, 3000);
    if (!inputText.trim()) return null;

    const system = `You are a CV parser. Extract education entries as structured JSON. Return ONLY valid JSON. Never invent data.`;

    const prompt = `Extract all education entries from this education section.

Return:
{
  "education": {
    "value": [
      {
        "qualification": "BA (Hons) Music Technology",
        "institution": "University of the Arts London",
        "dates": "2016 - 2019"
      }
    ],
    "confidence": 0.85,
    "source": "educationBlock"
  }
}

Rules:
- Each entry must have at minimum a qualification name
- Omit institution or dates if not present in the CV
- If the education section is too unstructured, return a single entry with the full text as qualification
- Return an empty array if no education is found

EDUCATION TEXT:
${inputText}`;

    const parsed = await callAI(system, prompt, "Education");
    if (!parsed.education?.value || !Array.isArray(parsed.education.value)) return null;

    return {
      value: parsed.education.value as EducationEntry[],
      confidence: typeof parsed.education.confidence === "number" ? parsed.education.confidence : 0.8,
      source: parsed.education.source || "educationBlock",
    };
  }
}

export const cvFieldExtractionService = new CvFieldExtractionService();
