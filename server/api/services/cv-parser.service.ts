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
    console.log(`🔍 Starting multi-stage CV pipeline for user ${userId}, file: ${cvFileUrl}`);
    await this.updateParsingStatus(userId, "parsing", cvFileUrl);

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
      const openAiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
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

      parsedData.confidenceData = confidenceData;
      parsedData.sectionData = Object.fromEntries(
        Object.entries(sections).filter(([, v]) => v.trim().length > 0)
      );

      console.log(`📊 Final fields: ${Object.keys(parsedData).filter(k => k !== "confidenceData" && k !== "sectionData" && (parsedData as any)[k] !== undefined).join(", ")}`);

      await this.saveParsedData(userId, parsedData, cvFileUrl, sections);

      // Notify frontend via WebSocket
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

      return parsedData;
    } catch (error) {
      console.error(`❌ CV parsing pipeline error for user ${userId}:`, error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error during CV parsing";
      await this.updateParsingStatus(userId, "failed", cvFileUrl, errorMessage);

      try {
        const { wsService } = await import("../websocket/websocketService.js");
        wsService.broadcastCVParsingUpdate(userId, "failed");
      } catch (wsError) {
        console.error("WebSocket broadcast error (non-critical):", wsError);
      }

      throw error;
    }
  }

  // ── Storage helpers ──────────────────────────────────────────────────────────

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

  private async saveParsedData(
    userId: number,
    data: ParsedCVData,
    cvFileUrl: string,
    sections: Record<string, string>
  ): Promise<void> {
    await storage.updateCvParsedData(userId, {
      status: "completed",
      cv_file_url: cvFileUrl,
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
  }
}

export const cvParserService = new CVParserService();
