import { PDFParse } from "pdf-parse";
import OpenAI from "openai";
import { storage } from "../../storage";
import { ObjectStorageService } from "../utils/object-storage";

export interface WorkHistoryEntry {
  title?: string;
  company?: string;
  dates?: string;
  description?: string;
}

export interface ParsedCVData {
  fullName?: string;
  title?: string;
  skills?: string[];
  bio?: string;
  location?: string;
  experienceYears?: number;
  education?: string;
  workHistory?: WorkHistoryEntry[];
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

// ── Fallback rule-based keyword lists (event industry only) ──────────────────

const SKILL_KEYWORDS = [
  "audio", "lighting", "video", "staging", "rigging", "av", "audio visual", "sound", "broadcast",
  "streaming", "live events", "festival", "conference", "exhibition", "concert", "touring",
  "production", "technical", "stage", "crew", "runner", "coordinator",
  "vmix", "obs", "resolume", "watchout", "disguise", "notch", "d3", "catalyst", "pandoras box",
  "barco", "christie", "nec", "panasonic", "epson", "jvc", "sony", "blackmagic", "atem",
  "digico", "yamaha", "midas", "allen & heath", "soundcraft", "avid", "venue",
  "ssl", "neve", "pro tools", "reaper", "ableton", "logic pro", "qlab",
  "grandma", "ma2", "ma3", "etc eos", "chamsys", "hog", "pearl", "strand",
  "genelec", "meyer sound", "d&b", "l-acoustics", "turbosound", "nexo",
  "dante", "milan", "ava", "audinate",
  "comms", "clearcom", "riedel", "bolero", "telex",
  "chain hoist", "manual hoist", "truss", "prolyte", "tomcat",
  "led wall", "led screen", "pixel pitch", "led processor", "nova star", "brompton",
  "camera", "ptz", "jib", "steadicam", "drone", "evs", "replay", "graphics",
  "powerpoint", "keynote", "google slides",
  "event management", "project management", "production management",
  "health and safety", "risk assessment", "method statement",
  "driving licence", "forklift", "scissor lift", "cherry picker",
  "autocad", "vectorworks", "sketchup", "wysiwyg", "capture", "depence",
  "stage management", "technical director", "av technician", "sound engineer",
  "lighting designer", "video technician", "camera operator",
];

const CERTIFICATION_KEYWORDS = [
  "ipaf", "pasma", "iosh", "nebosh", "cscs", "sia", "sia licence", "dbs", "dbs basic", "dbs enhanced",
  "first aid", "first aid at work", "emergency first aid", "efaw", "faw",
  "bs7909", "pli", "public liability", "professional indemnity",
  "dante certification", "dante level 1", "dante level 2", "dante level 3",
  "eal", "city & guilds", "btec", "nvq", "hnd", "degree", "masters", "phd", "diploma",
  "certificate", "certified", "licensed", "qualified", "accredited",
  "full uk driving licence", "category b", "category c",
  "scissor lift licence", "forklift licence", "cherry picker licence",
];

const EDUCATION_KEYWORDS = [
  "university", "college", "school", "degree", "bachelor", "master", "phd",
  "diploma", "certificate", "btec", "nvq", "a-level", "gcse", "education",
  "studied", "graduated", "qualification", "conservatoire", "academy",
  "institute", "foundation", "higher national",
];

const LOCATION_PATTERNS = [
  /(?:based in|located in|location[:\s]+|lives? in|from|residing in)\s*([A-Za-z][A-Za-z\s,]{2,30})/gi,
  /([A-Za-z]+(?:[\s-][A-Za-z]+)?),?\s*(?:UK|United Kingdom|England|Scotland|Wales|Northern Ireland)/gi,
];

const UK_CITIES = [
  "london", "manchester", "birmingham", "leeds", "glasgow", "edinburgh", "liverpool", "bristol",
  "sheffield", "newcastle", "brighton", "cardiff", "belfast", "nottingham", "leicester",
  "coventry", "hull", "bradford", "stoke", "derby", "southampton", "portsmouth", "oxford",
  "cambridge", "exeter", "york", "bath", "reading", "milton keynes", "norwich", "ipswich",
  "peterborough", "worcester", "gloucester", "swindon", "middlesbrough", "sunderland",
  "bolton", "wigan", "blackpool", "preston", "blackburn", "wolverhampton", "swansea",
  "dundee", "aberdeen", "inverness", "stirling", "perth",
  "east midlands", "west midlands", "west yorkshire", "south yorkshire", "north yorkshire",
  "east yorkshire", "greater manchester", "merseyside", "tyne and wear",
  "kent", "surrey", "essex", "hertfordshire", "buckinghamshire", "oxfordshire",
  "berkshire", "hampshire", "dorset", "somerset", "cornwall", "devon",
  "suffolk", "norfolk", "lincolnshire", "cheshire",
];

// ── CVParserService ───────────────────────────────────────────────────────────

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
      console.log(`📄 CV text preview (first 500 chars): ${text.substring(0, 500)}`);

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

  // ── AI extraction ───────────────────────────────────────────────────────────

  private async extractWithAI(text: string): Promise<ParsedCVData> {
    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY || !process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
      throw new Error("OpenAI integration not configured");
    }

    const systemMessage = `You are a structured data extractor specialising in event industry CVs. Your only job is to read a CV and return a JSON object containing specific fields. You follow rules exactly.

Core behaviour rules — read these before anything else:
- Return ONLY data that is explicitly written in the CV. Never infer, guess, or fabricate.
- If a field's data is absent, ambiguous, or you are not fully confident: OMIT the field entirely. An omitted field is always better than a wrong one.
- Do not paraphrase, reword, or improve any text you copy from the CV.
- Return valid JSON only. No markdown, no code fences, no explanation text.`;

    const prompt = `Extract structured data from this CV. Return a JSON object using only the fields defined below.

Read the ENTIRE CV before extracting. Skills and certifications may appear anywhere in the document.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FIELD DEFINITIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. "fullName"
   The person's full name as written on the CV.
   - Usually the first prominent line or heading
   - Return as written — do not reorder or alter
   - 1 to 4 words only
   - OMIT if you cannot identify a clear personal name

2. "title"
   Their primary professional job title — a SHORT label only.
   - Maximum 6 words
   - Must read like a job title, not a sentence or description
   - Look for it: near the top of the CV, below the name, or at the start of a profile summary
   - If multiple titles are present, pick the most senior or most recent one
   - Capitalise each main word (title case)

   GOOD examples (use these as the standard):
     "AV Technician"
     "Freelance Sound Engineer"
     "Senior Event Producer"
     "FOH Engineer & Lighting Designer"
     "Technical Director"
     "Stage Manager"

   BAD examples (never return these):
     "in the planning and execution of high-profile events"  ← sentence fragment
     "Experienced professional with 10 years"               ← description
     "Audio, Visual, and Technical Event Production"        ← list masquerading as title
     "Freelance"                                            ← too vague, not a title
     "Events"                                               ← too vague, not a title

   OMIT if no clear title exists.

3. "skills"
   A flat array of individual skills, tools, equipment, and software mentioned anywhere in the CV.
   - Each item: 1 to 4 words maximum
   - Use consistent title case (e.g. "Pro Tools", "DiGiCo SD7", "Stage Management")
   - Include brand names and model numbers where they add useful context (e.g. "Allen & Heath dLive", "Barco E2")
   - Include soft skills only if explicitly listed in a skills section (e.g. "Team Leadership") — do not infer them from job descriptions
   - Remove duplicates — do not list the same skill twice with different capitalisation
   - Do NOT include certifications here — those go in "certifications"
   - OMIT the field if no skills are found

4. "bio"
   The person's own written profile summary, personal statement, or about section.
   - Copy the text EXACTLY as written — do not edit, summarise, or clean it up
   - This section is usually labelled: "Profile", "About", "Summary", "Personal Statement", "About Me"
   - If no clearly labelled or clearly distinct profile summary exists: OMIT entirely
   - Do NOT construct a bio from other sections of the CV
   - Do NOT copy job descriptions, skills lists, or education as the bio

5. "location"
   Where the person is based, as stated in the CV.
   - Must be a real, specific place name: city, town, or region
   - Acceptable formats: "Glasgow", "Manchester", "London, UK", "West Yorkshire"
   - Maximum 5 words

   OMIT if any of the following apply:
   - No specific place name is mentioned
   - The text describes availability rather than location (e.g. "available UK-wide", "happy to travel")
   - The value is vague (e.g. "UK and Europe", "nationwide", "various locations", "remote")

6. "experienceYears"
   Total years of experience — as a number only.
   - Include ONLY if the CV explicitly states a figure, e.g. "8 years experience", "over 10 years in the industry"
   - Do NOT calculate or estimate from work history dates
   - Do NOT include if phrased as a range without a clear minimum (e.g. "several years")
   - OMIT if not explicitly stated

7. "education"
   Education history as it appears in the CV.
   - Copy from the CV as structured text: qualification, institution, dates (where given)
   - If multiple entries: separate with a line break or list them in order
   - OMIT if no education section or entries are present

8. "workHistory"
   Work experience entries as they appear in the CV.
   Return as an array of objects, each with:
     - "title": job title at that role
     - "company": employer or client name
     - "dates": date range as written (e.g. "Jan 2021 – Mar 2023", "2019 – Present")
     - "description": brief description or responsibilities if present (copy from CV, do not summarise)
   Omit any sub-field (title, company, dates, description) if not present for that entry.
   OMIT the entire field if no work history is found.

9. "certifications"
   Array of formal certifications, licences, and qualifications found anywhere in the CV.
   - Include: IPAF, PASMA, SIA, DBS, BS7909, First Aid, IOSH, NEBOSH, Dante Level 1/2/3, EAL, City & Guilds, BTEC, NVQ, HND, driving licences (specify class if stated), and similar
   - Do NOT include general skills or tools here — only formal qualifications
   - Do NOT duplicate entries already in "education"
   - Each item: copy the certification name as written, keeping abbreviations (e.g. "IPAF Licence", "DBS Enhanced")
   - OMIT if none found

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
OUTPUT FORMAT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Return a single valid JSON object. No wrapping text, no markdown, no code fences.
Include only fields you are confident about. Omit the rest.

{
  "fullName": "Sarah Okonkwo",
  "title": "Freelance Lighting Technician",
  "skills": ["ETC Eos", "MA2", "Strand 500", "Rigging", "Cable Management", "Team Leadership"],
  "bio": "Freelance lighting technician with extensive experience across live music, corporate events, and theatre. Comfortable in both touring and one-off event environments.",
  "location": "Bristol",
  "experienceYears": 7,
  "education": "BTEC Level 3 Diploma in Performing Arts — City of Bristol College, 2015",
  "workHistory": [
    {
      "title": "Lighting Technician",
      "company": "XYZ Productions",
      "dates": "2019 – Present",
      "description": "Programmed and operated ETC Eos for touring and festival shows. Responsible for rig inspection and safety checks."
    },
    {
      "title": "Lighting Operator",
      "company": "The Fleece, Bristol",
      "dates": "2016 – 2019",
      "description": "House lighting operator for all live events at 400-capacity venue."
    }
  ],
  "certifications": ["IPAF Licence", "First Aid at Work", "EAL Level 2 Rigging"]
}

CV TEXT:
${text.substring(0, 12000)}`;

    const response = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemMessage },
        { role: "user", content: prompt },
      ],
      response_format: { type: "json_object" },
      max_completion_tokens: 2048,
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No response from AI");
    }

    console.log(`🤖 AI raw response: ${content.substring(0, 1000)}`);

    const parsed = JSON.parse(content);

    // ── Post-processing validation ───────────────────────────────────────────

    const JUNK_VALUES = new Set([
      "n/a", "not specified", "unknown", "not found", "none", "not available",
      "not provided", "not mentioned", "omitted", "no information", "no data",
      "not stated", "not given", "not applicable",
    ]);

    const cleanString = (val: any): string | undefined => {
      if (!val || typeof val !== "string") return undefined;
      const trimmed = val.trim();
      if (trimmed.length === 0) return undefined;
      if (JUNK_VALUES.has(trimmed.toLowerCase())) return undefined;
      return trimmed;
    };

    const cleanTitle = (val: any): string | undefined => {
      const title = cleanString(val);
      if (!title) return undefined;
      if (title.length > 60) {
        console.log(`🤖 Title rejected (too long): "${title}"`);
        return undefined;
      }
      if (title.split(/\s+/).length > 8) {
        console.log(`🤖 Title rejected (too many words): "${title}"`);
        return undefined;
      }
      const badPrefixes = ["in ", "for ", "the ", "a ", "an ", "this ", "with ", "and ", "to ", "of ",
        "experienced", "passionate", "dedicated", "skilled", "qualified"];
      if (badPrefixes.some(p => title.toLowerCase().startsWith(p))) {
        console.log(`🤖 Title rejected (bad prefix): "${title}"`);
        return undefined;
      }
      if ((title.match(/,/g) || []).length > 2) {
        console.log(`🤖 Title rejected (too many commas): "${title}"`);
        return undefined;
      }
      return title;
    };

    const cleanLocation = (val: any): string | undefined => {
      const loc = cleanString(val);
      if (!loc) return undefined;
      const fakeLocations = new Set([
        "a single region", "single region", "multiple locations", "various locations",
        "uk and europe", "across the uk", "nationwide", "remote", "freelance",
        "available", "willing to travel", "uk wide", "uk-wide", "flexible",
      ]);
      if (fakeLocations.has(loc.toLowerCase())) {
        console.log(`🤖 Location rejected (not a real place): "${loc}"`);
        return undefined;
      }
      if (loc.split(/\s+/).length > 5) {
        console.log(`🤖 Location rejected (too long): "${loc}"`);
        return undefined;
      }
      return loc;
    };

    const cleanSkills = (val: any): string[] | undefined => {
      if (!Array.isArray(val) || val.length === 0) return undefined;
      const seen = new Set<string>();
      const result: string[] = [];
      for (const s of val) {
        if (typeof s !== "string") continue;
        const trimmed = s.trim();
        if (trimmed.length === 0 || trimmed.length > 40) continue;
        const key = trimmed.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        result.push(trimmed);
      }
      return result.length > 0 ? result : undefined;
    };

    const cleanWorkHistory = (val: any): WorkHistoryEntry[] | undefined => {
      if (!Array.isArray(val) || val.length === 0) return undefined;
      const result: WorkHistoryEntry[] = [];
      for (const entry of val) {
        if (typeof entry !== "object" || entry === null) continue;
        const item: WorkHistoryEntry = {};
        if (entry.title && typeof entry.title === "string") item.title = entry.title.trim();
        if (entry.company && typeof entry.company === "string") item.company = entry.company.trim();
        if (entry.dates && typeof entry.dates === "string") item.dates = entry.dates.trim();
        if (entry.description && typeof entry.description === "string") item.description = entry.description.trim();
        if (Object.keys(item).length > 0) result.push(item);
      }
      return result.length > 0 ? result : undefined;
    };

    const result: ParsedCVData = {
      fullName: cleanString(parsed.fullName),
      title: cleanTitle(parsed.title),
      skills: cleanSkills(parsed.skills),
      bio: cleanString(parsed.bio),
      location: cleanLocation(parsed.location),
      experienceYears:
        typeof parsed.experienceYears === "number" &&
        Number.isInteger(parsed.experienceYears) &&
        parsed.experienceYears >= 1 &&
        parsed.experienceYears <= 50
          ? parsed.experienceYears
          : undefined,
      education: cleanString(parsed.education),
      workHistory: cleanWorkHistory(parsed.workHistory),
      certifications: Array.isArray(parsed.certifications)
        ? parsed.certifications
            .filter((c: any) => typeof c === "string" && c.trim().length > 0)
            .map((c: string) => c.trim())
        : undefined,
    };

    console.log(`🤖 Parsed fields: ${Object.keys(result).filter(k => (result as any)[k] !== undefined).join(", ")}`);
    return result;
  }

  // ── Text extraction from PDF ────────────────────────────────────────────────

  private async extractTextFromCV(cvFileUrl: string): Promise<string> {
    const objectStorageService = new ObjectStorageService();

    const file = await objectStorageService.getCVFile(cvFileUrl);
    const [buffer] = await file.download();
    console.log(`📥 Downloaded CV file: ${buffer.length} bytes`);

    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    await (parser as any).load();
    const result = await parser.getText();
    const text = typeof result === "string" ? result : (result?.text || JSON.stringify(result));
    console.log(`📄 PDF text extracted: ${text.length} characters`);
    return text;
  }

  // ── Rule-based fallback ─────────────────────────────────────────────────────

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
      if (!line.includes("@") && !line.includes("http")) {
        const words = line.split(/\s+/);
        if (words.length >= 2 && words.length <= 4) {
          const allCapitalized = words.every(w => /^[A-Z]/.test(w));
          if (allCapitalized) return line;
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
      if (match && match[1]) return match[1].trim().slice(0, 60);
    }

    const jobTitleWords = [
      "manager", "engineer", "developer", "coordinator", "technician", "operator",
      "designer", "producer", "director", "assistant", "specialist",
    ];
    for (let i = 1; i < Math.min(8, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length >= 5 && line.length <= 60 && !line.includes("@")) {
        if (jobTitleWords.some(w => line.toLowerCase().includes(w))) return line;
      }
    }

    return undefined;
  }

  private extractSkills(normalizedText: string): string[] {
    const foundSkills: string[] = [];
    const seen = new Set<string>();

    for (const skill of SKILL_KEYWORDS) {
      const regex = new RegExp(`\\b${skill.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(normalizedText)) {
        const formatted = skill.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const key = formatted.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          foundSkills.push(formatted);
        }
      }
    }

    return foundSkills.slice(0, 25);
  }

  private extractBio(text: string): string | undefined {
    const bioPattern =
      /(?:profile|summary|about me|personal statement|objective)[:\s]*\n?([^]*?)(?=\n\s*(?:experience|education|skills|employment|work history|qualifications|certifications)|$)/i;
    const match = text.match(bioPattern);
    if (match && match[1]) {
      const bio = match[1].trim().replace(/\s+/g, " ");
      if (bio.length >= 20 && bio.length <= 1000) return bio.slice(0, 500);
    }
    return undefined;
  }

  private extractLocation(text: string): string | undefined {
    for (const pattern of LOCATION_PATTERNS) {
      pattern.lastIndex = 0;
      const match = pattern.exec(text);
      if (match && match[1]) {
        const location = match[1].trim();
        if (location.length >= 2 && location.length <= 50) return location;
      }
    }

    const normalizedText = text.toLowerCase();
    for (const city of UK_CITIES) {
      if (normalizedText.includes(city)) {
        return city.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
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
        if (years >= 1 && years <= 50) return years;
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
      if (education.length >= 10) return education;
    }

    return undefined;
  }

  private extractWorkHistory(text: string): WorkHistoryEntry[] | undefined {
    const workSection = text.match(
      /(?:experience|employment|work history|career history)[:\s]*\n?([^]*?)(?=\n\s*(?:education|skills|qualifications|certifications|references)|$)/i
    );

    if (workSection && workSection[1]) {
      const raw = workSection[1].trim();
      if (raw.length >= 20) {
        return [{ description: raw.slice(0, 1000) }];
      }
    }

    return undefined;
  }

  private extractCertifications(normalizedText: string): string[] {
    const foundCerts: string[] = [];
    const seen = new Set<string>();

    for (const cert of CERTIFICATION_KEYWORDS) {
      const regex = new RegExp(`\\b${cert.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
      if (regex.test(normalizedText)) {
        const formatted =
          cert.toUpperCase() === cert
            ? cert.toUpperCase()
            : cert.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
        const key = formatted.toLowerCase();
        if (!seen.has(key)) {
          seen.add(key);
          foundCerts.push(formatted);
        }
      }
    }

    return foundCerts.slice(0, 15);
  }

  // ── Storage helpers ─────────────────────────────────────────────────────────

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
      // workHistory is stored as a JSON string in the DB
      extracted_work_history: data.workHistory ? JSON.stringify(data.workHistory) : null,
      extracted_certifications: data.certifications || null,
    });
  }
}

export const cvParserService = new CVParserService();
