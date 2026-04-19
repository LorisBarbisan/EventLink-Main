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

    const prompt = `You are a CV document analyser. Your ONLY job is to split the CV text below into named sections.

Return a JSON object with these keys. For each key, copy the relevant portion of the CV text verbatim. If a section is absent, return an empty string for that key.

Keys:
- headerBlock: name, contact details, location, and job title at the top of the CV
- summaryBlock: profile summary, personal statement, or "about me" section
- skillsBlock: skills, tools, software, technical abilities section
- experienceBlock: work experience, employment history, career history section
- educationBlock: education, qualifications, academic history section
- certificationsBlock: certifications, licences, training section
- additionalBlock: anything else not captured above (languages, interests, references, etc.)

Rules:
- Copy the text exactly as it appears — do not edit or summarise
- If two sections appear merged (e.g., skills listed within experience), copy the full merged text into the most appropriate key
- Return valid JSON only — no markdown, no code fences

CV TEXT:
${cleanText.substring(0, 10000)}`;

    try {
      const abortController = new AbortController();
      const abortTimer = setTimeout(() => abortController.abort(), 60000);
      let response;
      try {
        response = await getOpenAIClient().chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: "You are a precise document parser. Return only valid JSON. Never invent content.",
            },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          max_completion_tokens: 3000,
          temperature: 0.0,
        }, { signal: abortController.signal });
      } finally {
        clearTimeout(abortTimer);
      }

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error("No response from section detection");

      const parsed = JSON.parse(content);
      return {
        headerBlock: parsed.headerBlock || "",
        summaryBlock: parsed.summaryBlock || "",
        skillsBlock: parsed.skillsBlock || "",
        experienceBlock: parsed.experienceBlock || "",
        educationBlock: parsed.educationBlock || "",
        certificationsBlock: parsed.certificationsBlock || "",
        additionalBlock: parsed.additionalBlock || "",
      };
    } catch (err) {
      console.warn("⚠️ Section detection AI failed, using rule-based fallback:", err);
      return this.ruleBased(cleanText);
    }
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
