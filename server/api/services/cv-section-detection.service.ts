import OpenAI from "openai";

export interface SectionBlocks {
  headerBlock: string;
  summaryBlock: string;
  skillsBlock: string;
  experienceBlock: string;
  educationBlock: string;
  certificationsBlock: string;
  additionalBlock: string;
}

const SECTION_KEYS: (keyof SectionBlocks)[] = [
  "headerBlock",
  "summaryBlock",
  "skillsBlock",
  "experienceBlock",
  "educationBlock",
  "certificationsBlock",
  "additionalBlock",
];

let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    openaiClient = new OpenAI({
      apiKey,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || undefined,
    });
  }
  return openaiClient;
}

export class CvSectionDetectionService {
  async detectSections(cleanText: string): Promise<SectionBlocks> {
    const openAiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
    if (!openAiKey) {
      return this.ruleBased(cleanText);
    }

    const lines = cleanText.split("\n");
    const numberedLines = lines
      .slice(0, 200)
      .map((line, i) => `${i}: ${line}`)
      .join("\n");

    const prompt = `You are a CV document analyser. Given the numbered CV lines below, identify the START line number (0-indexed) of each section.

Return ONLY a JSON object with these exact keys and integer values (the line number where each section starts, or -1 if absent):
{
  "headerBlock": 0,
  "summaryBlock": 5,
  "skillsBlock": 12,
  "experienceBlock": 20,
  "educationBlock": 50,
  "certificationsBlock": -1,
  "additionalBlock": -1
}

Section definitions:
- headerBlock: name, contact info, location, job title (almost always starts at line 0)
- summaryBlock: profile summary, personal statement, "about me"
- skillsBlock: skills, tools, software, technical abilities
- experienceBlock: work experience, employment history, career history
- educationBlock: education, qualifications, academic history
- certificationsBlock: certifications, licences, formal training
- additionalBlock: anything else (languages, interests, references)

Rules:
- Return ONLY the JSON object, no other text
- If a section is not present, return -1
- Each value must be an integer

CV LINES:
${numberedLines}`;

    try {
      const abortController = new AbortController();
      const abortTimer = setTimeout(() => abortController.abort(), 30000);
      let response;
      try {
        response = await getOpenAIClient().chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a precise document parser. Return only valid JSON with integer values.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 100,
          temperature: 0.0,
        }, { signal: abortController.signal });
      } finally {
        clearTimeout(abortTimer);
      }

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No response from section detection");

      const parsed = JSON.parse(content);

      return this.splitByLineNumbers(lines, parsed);
    } catch (err) {
      console.warn("⚠️ Section detection AI failed, using rule-based fallback:", err);
      return this.ruleBased(cleanText);
    }
  }

  private splitByLineNumbers(
    lines: string[],
    boundaries: Record<string, number>
  ): SectionBlocks {
    const blocks: SectionBlocks = {
      headerBlock: "",
      summaryBlock: "",
      skillsBlock: "",
      experienceBlock: "",
      educationBlock: "",
      certificationsBlock: "",
      additionalBlock: "",
    };

    const validSections = SECTION_KEYS
      .map(key => ({ key, start: typeof boundaries[key] === "number" ? boundaries[key] : -1 }))
      .filter(s => s.start >= 0)
      .sort((a, b) => a.start - b.start);

    for (let i = 0; i < validSections.length; i++) {
      const { key, start } = validSections[i];
      const end = i + 1 < validSections.length ? validSections[i + 1].start : lines.length;
      blocks[key] = lines.slice(start, end).join("\n").trim();
    }

    if (!blocks.headerBlock && lines.length > 0) {
      const firstSection = validSections[0]?.start ?? lines.length;
      blocks.headerBlock = lines.slice(0, Math.min(firstSection, 10)).join("\n").trim();
    }

    return blocks;
  }

  private ruleBased(text: string): SectionBlocks {
    const lines = text.split("\n");

    const SECTION_PATTERNS: Record<keyof SectionBlocks, RegExp> = {
      headerBlock: /^(?:name|contact|header|cv|curriculum vitae)/i,
      summaryBlock: /^(?:profile|summary|about|personal statement|objective|professional overview)/i,
      skillsBlock: /^(?:skills|technical skills|competencies|expertise|tools|software)/i,
      experienceBlock: /^(?:experience|employment|work history|career history|work experience|professional experience)/i,
      educationBlock: /^(?:education|qualifications|academic|training)/i,
      certificationsBlock: /^(?:certifications?|licences?|certificates?|credentials?|accreditations?)/i,
      additionalBlock: /^(?:additional|interests?|hobbies|languages?|references?|other)/i,
    };

    const blocks: SectionBlocks = {
      headerBlock: "",
      summaryBlock: "",
      skillsBlock: "",
      experienceBlock: "",
      educationBlock: "",
      certificationsBlock: "",
      additionalBlock: "",
    };

    let currentSection: keyof SectionBlocks | null = null;
    const sectionContent: Record<string, string[]> = {};

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      let matched: keyof SectionBlocks | null = null;
      for (const [key, pattern] of Object.entries(SECTION_PATTERNS)) {
        if (pattern.test(trimmed) && trimmed.length < 60) {
          matched = key as keyof SectionBlocks;
          break;
        }
      }

      if (matched) {
        currentSection = matched;
        if (!sectionContent[currentSection]) sectionContent[currentSection] = [];
      } else if (currentSection) {
        if (!sectionContent[currentSection]) sectionContent[currentSection] = [];
        sectionContent[currentSection].push(trimmed);
      } else {
        if (!sectionContent["headerBlock"]) sectionContent["headerBlock"] = [];
        sectionContent["headerBlock"].push(trimmed);
      }
    }

    for (const [key, lines] of Object.entries(sectionContent)) {
      (blocks as any)[key] = lines.join("\n");
    }

    if (!blocks.headerBlock) {
      blocks.headerBlock = lines.slice(0, 10).join("\n");
    }

    return blocks;
  }
}

export const cvSectionDetectionService = new CvSectionDetectionService();
