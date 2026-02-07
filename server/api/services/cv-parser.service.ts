import { PDFParse } from "pdf-parse";
import OpenAI from "openai";
import { storage } from "../../storage";
import { ObjectStorageService } from "../utils/object-storage";

export interface ParsedCVData {
  fullName?: string;
  title?: string;
  skills?: string[];
  bio?: string;
  location?: string;
  experienceYears?: number;
  education?: string;
  workHistory?: string;
  certifications?: string[];
}

// Lazy-initialized OpenAI client to avoid construction-time failures when env vars are missing
let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return openaiClient;
}

const SKILL_KEYWORDS = [
  "javascript", "typescript", "python", "java", "react", "node", "nodejs", "sql",
  "html", "css", "vue", "angular", "aws", "azure", "docker", "kubernetes",
  "git", "agile", "scrum", "project management", "communication", "leadership",
  "video production", "audio", "lighting", "stage management", "event management",
  "camera operator", "vmix", "obs", "streaming", "broadcast", "technical director",
  "av technician", "sound engineer", "lighting designer", "stage hand", "rigger",
  "production assistant", "runner", "coordinator", "live events", "festival",
  "conference", "exhibition", "corporate events", "weddings", "concerts",
  "powerpoint", "excel", "word", "photoshop", "premiere", "after effects",
  "final cut", "davinci resolve", "ableton", "pro tools", "logic pro",
  "first aid", "driving license", "forklift", "scissor lift", "cherry picker",
  "health and safety", "risk assessment", "crowd management", "security",
];

const CERTIFICATION_KEYWORDS = [
  "ipaf", "pasma", "iosh", "nebosh", "cscs", "sia", "first aid", "bs7909",
  "pli", "public liability", "professional indemnity", "btec", "nvq", "hnd",
  "degree", "masters", "mba", "phd", "diploma", "certificate", "certified",
  "licensed", "qualified", "accredited", "training", "course",
];

const EDUCATION_KEYWORDS = [
  "university", "college", "school", "degree", "bachelor", "master", "phd",
  "diploma", "certificate", "btec", "nvq", "a-level", "gcse", "education",
  "studied", "graduated", "qualification",
];

const LOCATION_PATTERNS = [
  /(?:based in|located in|location[:\s]+|lives? in|from)\s*([A-Za-z\s,]+)/gi,
  /([A-Za-z]+(?:\s+[A-Za-z]+)?),?\s*(?:UK|United Kingdom|England|Scotland|Wales)/gi,
];

export class CVParserService {
  async initParsingStatus(userId: number, cvFileUrl: string): Promise<void> {
    await this.updateParsingStatus(userId, "parsing", cvFileUrl);
    console.log(`📊 Parsing status set to "parsing" for user ${userId}`);
  }

  async parseCV(userId: number, cvFileUrl: string): Promise<ParsedCVData> {
    console.log(`🔍 Starting CV parsing for user ${userId}, file: ${cvFileUrl}`);

    try {

      const text = await this.extractTextFromCV(cvFileUrl);
      console.log(`📄 Extracted ${text.length} characters from CV`);

      // Try AI-based parsing first, fall back to rule-based
      let parsedData: ParsedCVData;
      try {
        parsedData = await this.extractWithAI(text);
        console.log(`🤖 AI extraction successful`);
      } catch (aiError) {
        console.warn(`⚠️ AI extraction failed, falling back to rule-based:`, aiError);
        parsedData = this.extractStructuredData(text);
      }
      console.log(`✅ Extracted data:`, JSON.stringify(parsedData, null, 2));

      await this.saveParsedData(userId, parsedData, cvFileUrl);

      // Notify frontend via WebSocket that parsing is complete
      try {
        const { wsService } = await import("../websocket/websocketService.js");
        wsService.broadcastCVParsingUpdate(userId, "completed", {
          fullName: parsedData.fullName,
          title: parsedData.title,
          skills: parsedData.skills,
          bio: parsedData.bio,
          location: parsedData.location,
          experienceYears: parsedData.experienceYears,
          education: parsedData.education,
          workHistory: parsedData.workHistory,
          certifications: parsedData.certifications,
        });
      } catch (wsError) {
        console.error("WebSocket broadcast error (non-critical):", wsError);
      }

      return parsedData;
    } catch (error) {
      console.error(`❌ CV parsing error for user ${userId}:`, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error during CV parsing";
      await this.updateParsingStatus(userId, "failed", cvFileUrl, errorMessage);

      // Notify frontend via WebSocket that parsing failed
      try {
        const { wsService } = await import("../websocket/websocketService.js");
        wsService.broadcastCVParsingUpdate(userId, "failed");
      } catch (wsError) {
        console.error("WebSocket broadcast error (non-critical):", wsError);
      }

      throw error;
    }
  }

  private async extractWithAI(text: string): Promise<ParsedCVData> {
    // Check if OpenAI integration is configured
    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY || !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
      throw new Error("OpenAI integration not configured");
    }

    const prompt = `You are an expert CV/resume parser for the events industry. Analyze this CV text and extract the following information in JSON format:

{
  "fullName": "The person's full name",
  "title": "Their professional title or job role (e.g., 'Event Manager', 'AV Technician', 'Stage Manager')",
  "skills": ["Array of relevant skills - include technical skills, software, equipment, certifications"],
  "bio": "A 2-3 sentence professional summary about this person based on their experience",
  "location": "Their city/region/country location (e.g. 'London', 'Manchester', 'UK', 'Scotland')",
  "experienceYears": number of years of experience (estimate from work history),
  "education": "Education background summary",
  "workHistory": "Brief work history summary",
  "certifications": ["Array of certifications like IPAF, PASMA, First Aid, etc."]
}

Focus on events industry relevant skills like: AV equipment, staging, lighting, sound, video production, event coordination, etc.

If a field cannot be determined, omit it from the response.

CV TEXT:
${text.substring(0, 8000)}`;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
      max_completion_tokens: 1024,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    const parsed = JSON.parse(content);
    
    return {
      fullName: parsed.fullName || undefined,
      title: parsed.title || undefined,
      skills: Array.isArray(parsed.skills) ? parsed.skills : undefined,
      bio: parsed.bio || undefined,
      location: parsed.location || undefined,
      experienceYears: typeof parsed.experienceYears === "number" ? parsed.experienceYears : undefined,
      education: parsed.education || undefined,
      workHistory: parsed.workHistory || undefined,
      certifications: Array.isArray(parsed.certifications) ? parsed.certifications : undefined,
    };
  }

  private async extractTextFromCV(cvFileUrl: string): Promise<string> {
    const objectStorageService = new ObjectStorageService();
    
    // Use ObjectStorageService.getCVFile for production-safe file access
    const file = await objectStorageService.getCVFile(cvFileUrl);
    const [buffer] = await file.download();
    console.log(`📥 Downloaded CV file: ${buffer.length} bytes`);

    // PDFParse constructor takes options including data as Uint8Array
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    await (parser as any).load();
    const result = await parser.getText();
    // getText() returns an object with .text property containing all page text
    const text = typeof result === "string" ? result : (result?.text || JSON.stringify(result));
    console.log(`📄 PDF text extracted: ${text.length} characters`);
    return text;
  }

  private extractStructuredData(text: string): ParsedCVData {
    const normalizedText = text.toLowerCase();
    const lines = text.split("\n").map(l => l.trim()).filter(l => l);

    return {
      fullName: this.extractFullName(lines),
      title: this.extractTitle(lines, normalizedText),
      skills: this.extractSkills(normalizedText),
      bio: this.extractBio(text),
      location: this.extractLocation(text),
      experienceYears: this.extractExperienceYears(normalizedText),
      education: this.extractEducation(text),
      workHistory: this.extractWorkHistory(text),
      certifications: this.extractCertifications(normalizedText),
    };
  }

  private extractFullName(lines: string[]): string | undefined {
    for (let i = 0; i < Math.min(5, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length < 3 || line.length > 50) continue;
      if (/^[a-z]/i.test(line) && !line.includes("@") && !line.includes("http")) {
        const words = line.split(/\s+/);
        if (words.length >= 2 && words.length <= 4) {
          const allCapitalized = words.every(w => /^[A-Z]/.test(w));
          if (allCapitalized) {
            return line;
          }
        }
      }
    }
    return undefined;
  }

  private extractTitle(lines: string[], normalizedText: string): string | undefined {
    const titlePatterns = [
      /(?:professional\s+)?(?:role|title|position)[:\s]+([^\n]+)/i,
      /(?:i am a|working as|currently|experienced)\s+([a-z\s]+(?:engineer|developer|manager|coordinator|technician|operator|designer|producer|director))/i,
    ];

    for (const pattern of titlePatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        return match[1].trim().slice(0, 100);
      }
    }

    for (let i = 1; i < Math.min(8, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length >= 5 && line.length <= 60 && !line.includes("@")) {
        const jobTitleWords = ["manager", "engineer", "developer", "coordinator", "technician", "operator", "designer", "producer", "director", "assistant", "specialist"];
        if (jobTitleWords.some(w => line.toLowerCase().includes(w))) {
          return line;
        }
      }
    }

    return undefined;
  }

  private extractSkills(normalizedText: string): string[] {
    const foundSkills: string[] = [];

    for (const skill of SKILL_KEYWORDS) {
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(normalizedText)) {
        const formattedSkill = skill.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        if (!foundSkills.includes(formattedSkill)) {
          foundSkills.push(formattedSkill);
        }
      }
    }

    return foundSkills.slice(0, 20);
  }

  private extractBio(text: string): string | undefined {
    const bioPatterns = [
      /(?:profile|summary|about me|personal statement|objective)[:\s]*\n?([^]*?)(?=\n\s*(?:experience|education|skills|employment|work history|qualifications|certifications)|$)/i,
    ];

    for (const pattern of bioPatterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        const bio = match[1].trim().replace(/\s+/g, " ");
        if (bio.length >= 20 && bio.length <= 1000) {
          return bio.slice(0, 500);
        }
      }
    }

    return undefined;
  }

  private extractLocation(text: string): string | undefined {
    for (const pattern of LOCATION_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match && match[1]) {
        const location = match[1].trim();
        if (location.length >= 2 && location.length <= 100) {
          return location;
        }
      }
    }

    const ukCities = ["london", "manchester", "birmingham", "leeds", "glasgow", "edinburgh", "liverpool", "bristol", "sheffield", "newcastle", "brighton", "cardiff", "belfast", "nottingham", "leicester"];
    const normalizedText = text.toLowerCase();
    for (const city of ukCities) {
      if (normalizedText.includes(city)) {
        return city.charAt(0).toUpperCase() + city.slice(1);
      }
    }

    return undefined;
  }

  private extractExperienceYears(normalizedText: string): number | undefined {
    const yearPatterns = [
      /(\d+)\+?\s*years?\s*(?:of\s+)?(?:experience|working)/i,
      /(?:over|more than)\s*(\d+)\s*years?/i,
      /experience[:\s]+(\d+)\s*years?/i,
    ];

    for (const pattern of yearPatterns) {
      const match = normalizedText.match(pattern);
      if (match && match[1]) {
        const years = parseInt(match[1], 10);
        if (years >= 1 && years <= 50) {
          return years;
        }
      }
    }

    return undefined;
  }

  private extractEducation(text: string): string | undefined {
    const educationSection = text.match(
      /(?:education|qualifications|academic)[:\s]*\n?([^]*?)(?=\n\s*(?:experience|skills|employment|work history|certifications|references)|$)/i
    );

    if (educationSection && educationSection[1]) {
      const education = educationSection[1].trim().slice(0, 500);
      if (education.length >= 10) {
        return education;
      }
    }

    return undefined;
  }

  private extractWorkHistory(text: string): string | undefined {
    const workSection = text.match(
      /(?:experience|employment|work history|career history)[:\s]*\n?([^]*?)(?=\n\s*(?:education|skills|qualifications|certifications|references)|$)/i
    );

    if (workSection && workSection[1]) {
      const work = workSection[1].trim().slice(0, 1000);
      if (work.length >= 20) {
        return work;
      }
    }

    return undefined;
  }

  private extractCertifications(normalizedText: string): string[] {
    const foundCerts: string[] = [];

    for (const cert of CERTIFICATION_KEYWORDS) {
      const regex = new RegExp(`\\b${cert.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(normalizedText)) {
        const formattedCert = cert.toUpperCase() === cert ? cert.toUpperCase() : cert.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        if (!foundCerts.includes(formattedCert)) {
          foundCerts.push(formattedCert);
        }
      }
    }

    return foundCerts.slice(0, 10);
  }

  private async updateParsingStatus(
    userId: number,
    status: "pending" | "parsing" | "completed" | "failed",
    cvFileUrl: string,
    errorMessage?: string
  ): Promise<void> {
    const existing = await storage.getCvParsedData(userId);

    if (existing) {
      await storage.updateCvParsedData(userId, {
        status,
        cv_file_url: cvFileUrl,
        error_message: errorMessage || null,
      });
    } else {
      await storage.createCvParsedData({
        user_id: userId,
        status,
        cv_file_url: cvFileUrl,
        error_message: errorMessage || null,
      });
    }
  }

  private async saveParsedData(userId: number, data: ParsedCVData, cvFileUrl: string): Promise<void> {
    await storage.updateCvParsedData(userId, {
      status: "completed",
      cv_file_url: cvFileUrl,
      extracted_full_name: data.fullName || null,
      extracted_title: data.title || null,
      extracted_skills: data.skills || null,
      extracted_bio: data.bio || null,
      extracted_location: data.location || null,
      extracted_experience_years: data.experienceYears || null,
      extracted_education: data.education || null,
      extracted_work_history: data.workHistory || null,
      extracted_certifications: data.certifications || null,
    });
  }
}

export const cvParserService = new CVParserService();
