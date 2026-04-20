import { storage } from "../../storage";
import { cvTextExtractionService } from "./cv-text-extraction.service";
import { cvSectionDetectionService } from "./cv-section-detection.service";
import { cvFieldExtractionService } from "./cv-field-extraction.service";
import { cvNormalizationService, type NormalizedFields } from "./cv-normalization.service";

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

export interface ParsedCVData {
  fullName?: string;
  title?: string;
  skills?: string[];
  bio?: string;
  location?: string;
  experienceYears?: number;
  workHistory?: WorkHistoryEntry[];
  education?: EducationEntry[];
  certifications?: string[];
  confidenceData?: Record<string, { confidence: number; source: string }>;
  sectionData?: Record<string, string>;
}

export class CVParserService {
  async initParsingStatus(userId: number, cvFileUrl: string): Promise<void> {
    await this.updateParsingStatus(userId, "parsing", cvFileUrl);
    console.log(`📊 Parsing status set to "parsing" for user ${userId}`);
  }

  async parseCV(userId: number, cvFileUrl: string, contentType?: string): Promise<ParsedCVData> {
    const PARSE_TIMEOUT_MS = 3 * 60 * 1000;
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`CV parsing timed out after 3 minutes for user ${userId}`)), PARSE_TIMEOUT_MS)
    );
    return Promise.race([this._parseCV(userId, cvFileUrl, contentType), timeoutPromise]);
  }

  private async _parseCV(userId: number, cvFileUrl: string, contentType?: string): Promise<ParsedCVData> {
    console.log(`🔍 Starting multi-stage CV pipeline for user ${userId}, file: ${cvFileUrl}`);
    // NOTE: initParsingStatus is always called before _parseCV by all callers,
    // so no need to call updateParsingStatus("parsing") again here — that would
    // risk overwriting cv_file_url back to an old URL if two parses race.

    try {
      // ── Stage B: Text extraction ────────────────────────────────────────────
      console.log("📄 Stage B: Text extraction");
      const extracted = await cvTextExtractionService.extractFromUrl(cvFileUrl, contentType);
      console.log(`📄 Extracted ${extracted.cleanText.length} chars, ${extracted.lines.length} lines`);

      // ── Stage C: Section detection ──────────────────────────────────────────
      console.log("🗂️ Stage C: Section detection");
      const sections = await cvSectionDetectionService.detectSections(extracted.cleanText);
      const sectionsWithContent = Object.entries(sections)
        .filter(([, v]) => v.trim().length > 0)
        .map(([k]) => k);
      console.log(`🗂️ Detected sections: ${sectionsWithContent.join(", ")}`);

      // ── Stage D: Field extraction (4 parallel AI prompts) ──────────────────
      console.log("🤖 Stage D: Multi-prompt field extraction");
      let rawFields;
      const openAiKey = process.env.OPENAI_API_KEY || process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
      if (openAiKey) {
        rawFields = await cvFieldExtractionService.extractAllFields(sections, extracted.cleanText);
      } else {
        console.warn("⚠️ OpenAI not configured (set OPENAI_API_KEY secret), using empty raw fields");
        rawFields = {};
      }

      // ── Stage E: Normalisation and validation ───────────────────────────────
      console.log("✅ Stage E: Normalisation and validation");
      const normalised = cvNormalizationService.normalizeAll(rawFields);
      console.log(`✅ Normalised fields: ${Object.keys(normalised).filter(k => (normalised as any)[k] !== undefined).join(", ")}`);

      // ── Build ParsedCVData (only high-confidence fields) ───────────────────
      const CONFIDENCE_THRESHOLD = 0.55;
      const parsedData: ParsedCVData = {};
      const confidenceData: Record<string, { confidence: number; source: string }> = {};

      for (const [field, scored] of Object.entries(normalised) as [keyof NormalizedFields, any][]) {
        if (!scored) continue;
        if (typeof scored.confidence === "number" && scored.confidence < CONFIDENCE_THRESHOLD) {
          console.log(`🔻 Field "${field}" below confidence threshold (${scored.confidence.toFixed(2)}), omitting`);
          continue;
        }
        (parsedData as any)[field] = scored.value;
        confidenceData[field] = { confidence: scored.confidence, source: scored.source };
      }

      // Infer title from most recent work history entry if not directly extracted
      if (!parsedData.title && parsedData.workHistory?.length) {
        const mostRecent = parsedData.workHistory[0];
        if (mostRecent.jobTitle) {
          parsedData.title = mostRecent.jobTitle;
          confidenceData.title = { confidence: 0.7, source: "inferred_from_work_history" };
          console.log(`🔄 Inferred title "${parsedData.title}" from most recent work history`);
        }
      }

      // Calculate experience years from work history date ranges if not directly extracted
      if (!parsedData.experienceYears && parsedData.workHistory?.length) {
        const years = this.calculateExperienceYears(parsedData.workHistory);
        if (years > 0) {
          parsedData.experienceYears = years;
          confidenceData.experienceYears = { confidence: 0.75, source: "calculated_from_work_history" };
          console.log(`🔄 Calculated ${years} years experience from work history dates`);
        }
      }

      parsedData.confidenceData = confidenceData;
      parsedData.sectionData = Object.fromEntries(
        Object.entries(sections).filter(([, v]) => v.trim().length > 0)
      );

      console.log(`📊 Final fields: ${Object.keys(parsedData).filter(k => k !== "confidenceData" && k !== "sectionData" && (parsedData as any)[k] !== undefined).join(", ")}`);

      const saved = await this.saveParsedData(userId, parsedData, cvFileUrl, sections as Record<string, string>);

      // Only broadcast if we actually persisted results (not a stale/superseded parse)
      if (saved) {
        try {
          const { wsService } = await import("../websocket/websocketService.js");
          wsService.broadcastCVParsingUpdate(userId, "completed", {
            fullName: parsedData.fullName,
            title: parsedData.title,
            skills: parsedData.skills,
            bio: parsedData.bio,
            location: parsedData.location,
            experienceYears: parsedData.experienceYears,
            workHistory: parsedData.workHistory,
            education: parsedData.education,
            certifications: parsedData.certifications,
            confidenceData,
          });
        } catch (wsError) {
          console.error("WebSocket broadcast error (non-critical):", wsError);
        }
      }

      return parsedData;
    } catch (error) {
      console.error(`❌ CV parsing pipeline error for user ${userId}:`, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error during CV parsing";
      const failedUpdated = await this.updateParsingStatus(userId, "failed", cvFileUrl, errorMessage);

      // Only broadcast "failed" if this parse is still the active one (not superseded)
      if (failedUpdated) {
        try {
          const { wsService } = await import("../websocket/websocketService.js");
          wsService.broadcastCVParsingUpdate(userId, "failed");
        } catch (wsError) {
          console.error("WebSocket broadcast error (non-critical):", wsError);
        }
      }

      throw error;
    }
  }

  // ── Inference helpers ────────────────────────────────────────────────────────

  private calculateExperienceYears(workHistory: WorkHistoryEntry[]): number {
    const now = new Date();
    let earliestStart: Date | null = null;

    for (const entry of workHistory) {
      if (!entry.dates) continue;

      // Extract years from date strings like "Jan 2019 - Present", "2020 - 2023", "June 2019 - April 2020"
      const yearMatches = entry.dates.match(/\b(19|20)\d{2}\b/g);
      if (!yearMatches?.length) continue;

      const startYear = parseInt(yearMatches[0], 10);
      // Try to extract month for better accuracy
      const monthMatch = entry.dates.match(
        /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s*(19|20)\d{2}/i
      );
      const startMonth = monthMatch
        ? new Date(`${monthMatch[1]} 1, ${startYear}`).getMonth()
        : 0;
      const startDate = new Date(startYear, startMonth);

      if (!earliestStart || startDate < earliestStart) {
        earliestStart = startDate;
      }
    }

    if (!earliestStart) return 0;

    const totalYears = Math.round(
      (now.getTime() - earliestStart.getTime()) / (365.25 * 24 * 60 * 60 * 1000)
    );
    return Math.min(Math.max(totalYears, 1), 50);
  }

  // ── Storage helpers ──────────────────────────────────────────────────────────

  private async updateParsingStatus(
    userId: number,
    status: "pending" | "parsing" | "completed" | "failed",
    cvFileUrl: string,
    errorMessage?: string
  ): Promise<boolean> {
    const existing = await storage.getCvParsedData(userId);
    if (existing) {
      // Guard against stale parses (for a superseded CV file) from writing terminal states.
      // "parsing" updates are allowed (initParsingStatus legitimately changes the active URL).
      if (
        existing.cv_file_url !== cvFileUrl &&
        (status === "completed" || status === "failed")
      ) {
        console.log(`⚠️ Stale ${status} update for user ${userId} (old CV file), ignoring`);
        return false;
      }
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
    return true;
  }

  private async saveParsedData(
    userId: number,
    data: ParsedCVData,
    cvFileUrl: string,
    sections: Record<string, string>
  ): Promise<boolean> {
    // Guard against a stale parse (old CV file) overwriting a newer parse's results
    const current = await storage.getCvParsedData(userId);
    if (current && current.cv_file_url !== cvFileUrl) {
      console.log(`⚠️ Stale parse result for user ${userId} (old CV file superseded), discarding`);
      return false;
    }
    await storage.updateCvParsedData(userId, {
      status: "completed",
      cv_file_url: cvFileUrl,
      parsed_at: new Date(),
      extracted_full_name: data.fullName || null,
      extracted_title: data.title || null,
      extracted_skills: data.skills || null,
      extracted_bio: data.bio || null,
      extracted_location: data.location || null,
      extracted_experience_years: data.experienceYears || null,
      extracted_education: data.education ? JSON.stringify(data.education) : null,
      extracted_work_history: data.workHistory ? JSON.stringify(data.workHistory) : null,
      extracted_certifications: data.certifications || null,
      section_data: JSON.stringify(sections),
      confidence_data: data.confidenceData ? JSON.stringify(data.confidenceData) : null,
    });
    return true;
  }
}

export const cvParserService = new CVParserService();
