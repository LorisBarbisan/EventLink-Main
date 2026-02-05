import type { Request, Response } from "express";
import { z } from "zod";
import { storage } from "../../storage";
import { cvParserService } from "../services/cv-parser.service";

const selectedFieldsSchema = z.object({
  fullName: z.boolean().optional().default(false),
  title: z.boolean().optional().default(false),
  skills: z.boolean().optional().default(false),
  bio: z.boolean().optional().default(false),
  location: z.boolean().optional().default(false),
  experienceYears: z.boolean().optional().default(false),
});

export async function triggerCVParsing(req: Request, res: Response) {
  try {
    if (!(req as any).user || (req as any).user.role !== "freelancer") {
      return res.status(403).json({ error: "Only freelancers can parse CVs" });
    }

    const userId = (req as any).user.id;

    const profile = await storage.getFreelancerProfile(userId);
    if (!profile || !profile.cv_file_url) {
      return res.status(404).json({ error: "No CV found to parse. Please upload a CV first." });
    }

    const existing = await storage.getCvParsedData(userId);
    if (existing && existing.status === "parsing") {
      return res.status(409).json({ error: "CV parsing is already in progress" });
    }

    cvParserService.parseCV(userId, profile.cv_file_url).catch(err => {
      console.error(`Background CV parsing failed for user ${userId}:`, err);
    });

    res.json({
      message: "CV parsing started",
      status: "parsing",
    });
  } catch (error) {
    console.error("Trigger CV parsing error:", error);
    res.status(500).json({ error: "Failed to start CV parsing" });
  }
}

export async function getCVParsingStatus(req: Request, res: Response) {
  try {
    if (!(req as any).user || (req as any).user.role !== "freelancer") {
      return res.status(403).json({ error: "Only freelancers can view CV parsing status" });
    }

    const userId = (req as any).user.id;
    const parsedData = await storage.getCvParsedData(userId);

    if (!parsedData) {
      return res.json({
        status: "none",
        message: "No CV has been parsed yet",
      });
    }

    res.json({
      status: parsedData.status,
      errorMessage: parsedData.error_message,
      extractedData: parsedData.status === "completed" ? {
        fullName: parsedData.extracted_full_name,
        title: parsedData.extracted_title,
        skills: parsedData.extracted_skills,
        bio: parsedData.extracted_bio,
        location: parsedData.extracted_location,
        experienceYears: parsedData.extracted_experience_years,
        education: parsedData.extracted_education,
        workHistory: parsedData.extracted_work_history,
        certifications: parsedData.extracted_certifications,
      } : null,
      parsedAt: parsedData.parsed_at,
      confirmedAt: parsedData.confirmed_at,
    });
  } catch (error) {
    console.error("Get CV parsing status error:", error);
    res.status(500).json({ error: "Failed to get CV parsing status" });
  }
}

export async function confirmCVData(req: Request, res: Response) {
  try {
    if (!(req as any).user || (req as any).user.role !== "freelancer") {
      return res.status(403).json({ error: "Only freelancers can confirm CV data" });
    }

    const userId = (req as any).user.id;
    const parsedData = await storage.getCvParsedData(userId);

    if (!parsedData || parsedData.status !== "completed") {
      return res.status(400).json({ error: "No completed CV parsing to confirm" });
    }

    const parseResult = selectedFieldsSchema.safeParse(req.body.selectedFields);
    if (!parseResult.success) {
      return res.status(400).json({ 
        error: "Invalid selectedFields format",
        details: parseResult.error.errors,
      });
    }
    const selectedFields = parseResult.data;

    const profileUpdates: Record<string, any> = {};

    if (selectedFields.fullName && parsedData.extracted_full_name) {
      const nameParts = parsedData.extracted_full_name.split(" ");
      profileUpdates.first_name = nameParts[0];
      profileUpdates.last_name = nameParts.slice(1).join(" ") || null;
    }

    if (selectedFields.title && parsedData.extracted_title) {
      profileUpdates.title = parsedData.extracted_title;
    }

    if (selectedFields.skills && parsedData.extracted_skills) {
      profileUpdates.skills = parsedData.extracted_skills;
    }

    if (selectedFields.bio && parsedData.extracted_bio) {
      profileUpdates.bio = parsedData.extracted_bio;
    }

    if (selectedFields.location && parsedData.extracted_location) {
      profileUpdates.location = parsedData.extracted_location;
    }

    if (selectedFields.experienceYears && parsedData.extracted_experience_years) {
      profileUpdates.experience_years = parsedData.extracted_experience_years;
    }

    if (Object.keys(profileUpdates).length > 0) {
      await storage.updateFreelancerProfile(userId, profileUpdates);
    }

    await storage.updateCvParsedData(userId, {
      status: "confirmed",
    });

    const updatedProfile = await storage.getFreelancerProfile(userId);

    res.json({
      message: "CV data confirmed and profile updated",
      profile: updatedProfile,
      fieldsUpdated: Object.keys(profileUpdates),
    });
  } catch (error) {
    console.error("Confirm CV data error:", error);
    res.status(500).json({ error: "Failed to confirm CV data" });
  }
}

export async function rejectCVData(req: Request, res: Response) {
  try {
    if (!(req as any).user || (req as any).user.role !== "freelancer") {
      return res.status(403).json({ error: "Only freelancers can reject CV data" });
    }

    const userId = (req as any).user.id;
    const parsedData = await storage.getCvParsedData(userId);

    if (!parsedData || parsedData.status !== "completed") {
      return res.status(400).json({ error: "No completed CV parsing to reject" });
    }

    await storage.updateCvParsedData(userId, {
      status: "rejected",
    });

    res.json({
      message: "CV data rejected",
    });
  } catch (error) {
    console.error("Reject CV data error:", error);
    res.status(500).json({ error: "Failed to reject CV data" });
  }
}

export async function reparseCV(req: Request, res: Response) {
  try {
    if (!(req as any).user || (req as any).user.role !== "freelancer") {
      return res.status(403).json({ error: "Only freelancers can reparse CVs" });
    }

    const userId = (req as any).user.id;

    const profile = await storage.getFreelancerProfile(userId);
    if (!profile || !profile.cv_file_url) {
      return res.status(404).json({ error: "No CV found to parse. Please upload a CV first." });
    }

    const existing = await storage.getCvParsedData(userId);
    if (existing && existing.status === "parsing") {
      return res.status(409).json({ error: "CV parsing is already in progress" });
    }

    if (existing) {
      await storage.deleteCvParsedData(userId);
    }

    cvParserService.parseCV(userId, profile.cv_file_url).catch(err => {
      console.error(`Background CV parsing failed for user ${userId}:`, err);
    });

    res.json({
      message: "CV reparsing started",
      status: "parsing",
    });
  } catch (error) {
    console.error("Reparse CV error:", error);
    res.status(500).json({ error: "Failed to reparse CV" });
  }
}
