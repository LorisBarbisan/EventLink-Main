import { Request, Response } from "express";
import { storage } from "../../storage.js";
import { ObjectStorageService } from "../utils/object-storage.js";

// 5.1 — Send a brief for a confirmed booking
export const sendBrief = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const bookingId = parseInt(req.params.bookingId);
    if (isNaN(bookingId)) return res.status(400).json({ error: "Invalid booking ID" });

    const booking = await storage.getBookingById(bookingId);
    if (!booking) return res.status(404).json({ error: "Booking not found" });
    if (booking.employerId !== employerId) return res.status(403).json({ error: "Forbidden" });
    if (booking.status !== "confirmed" && booking.status !== "briefed") {
      return res.status(400).json({ error: "Can only send briefs for confirmed bookings" });
    }

    const brief = await storage.createBrief({
      bookingId,
      employerId,
      freelancerId: booking.freelancerId,
      ...req.body,
    });

    await storage.updateBookingStatus(bookingId, "briefed", employerId, "Brief sent");

    const employer = await storage.getRecruiterProfile(employerId);
    const freelancer = await storage.getUser(booking.freelancerId);
    const profile = await storage.getFreelancerProfile(booking.freelancerId);
    const firstName = (profile as any)?.first_name ?? freelancer?.first_name ?? "there";
    const baseUrl = req.protocol + "://" + req.get("host");

    const { sendEmail } = await import("../utils/emailService.js");
    const { generateBriefEmail } = await import("../utils/emailTemplates.js");
    const briefWithAttachments = await storage.getBriefByBookingId(bookingId);
    const html = generateBriefEmail({
      freelancerFirstName: firstName,
      employerName: employer?.company_name ?? "Your employer",
      eventTitle: brief.eventTitle,
      eventDate: brief.eventDate,
      callTime: brief.callTime,
      venueAddress: brief.venueAddress,
      roleRequired: brief.roleRequired,
      agreedRate: brief.agreedRate,
      details: brief.details,
      dresscode: brief.dresscode,
      parkingInfo: brief.parkingInfo,
      contactOnDay: brief.contactOnDay,
      scheduleNotes: brief.scheduleNotes,
      hasAttachments: (briefWithAttachments?.attachments?.length ?? 0) > 0,
      acknowledgeToken: brief.token,
      baseUrl,
    });

    if (freelancer?.email) {
      await sendEmail({
        to: freelancer.email,
        subject: `Job brief: ${brief.eventTitle} on ${brief.eventDate}`,
        html,
      });
    }

    return res.status(201).json(brief);
  } catch (error: any) {
    console.error("sendBrief error:", error.message, error.stack);
    if (error.message === "A brief has already been sent for this booking") {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

// 5.2 — Get brief for a booking (employer)
export const getBriefForBooking = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const bookingId = parseInt(req.params.bookingId);
    if (isNaN(bookingId)) return res.status(400).json({ error: "Invalid booking ID" });

    const brief = await storage.getBriefByBookingId(bookingId);
    if (!brief) return res.status(404).json({ error: "No brief found for this booking" });
    if (brief.employerId !== employerId) return res.status(403).json({ error: "Forbidden" });

    return res.json(brief);
  } catch (error: any) {
    console.error("getBriefForBooking error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// 5.3 — Get brief by token (public — no auth)
export const getBriefByTokenHandler = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const result = await storage.getBriefByToken(token);
    if (!result) return res.status(404).json({ error: "Brief not found" });

    const attachmentsWithUrls = await Promise.all(
      (result.brief.attachments ?? []).map(async (att: any) => {
        const downloadUrl = await ObjectStorageService.getDownloadUrl(att.objectPath);
        return { ...att, downloadUrl };
      })
    );

    return res.json({
      ...result,
      brief: { ...result.brief, attachments: attachmentsWithUrls },
    });
  } catch (error: any) {
    console.error("getBriefByToken error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// 5.4 — Acknowledge brief (public — no auth)
export const acknowledgeBriefHandler = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const note = req.body?.note as string | undefined;
    const brief = await storage.acknowledgeBrief(token, note);
    if (!brief) return res.status(404).json({ error: "Brief not found" });

    try {
      const { sendEmail } = await import("../utils/emailService.js");
      const freelancer = await storage.getUser(brief.freelancerId);
      const employer = await storage.getUser(brief.employerId);
      const fullName = `${freelancer?.first_name ?? ""} ${freelancer?.last_name ?? ""}`.trim();
      if (employer?.email) {
        await sendEmail({
          to: employer.email,
          subject: `Brief acknowledged: ${brief.eventTitle}`,
          html: `<p>${fullName} has acknowledged the brief for <strong>${brief.eventTitle}</strong>.
            ${note ? `<br><br>Their message: <em>${note}</em>` : ""}</p>`,
        });
      }
    } catch (emailError) {
      console.error("Brief ack email failed (non-blocking):", emailError);
    }

    return res.json({ success: true, brief });
  } catch (error: any) {
    console.error("acknowledgeBrief error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// 5.5 — Template controllers
export const getBriefTemplates = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const templates = await storage.getBriefTemplates(employerId);
    return res.json(templates);
  } catch (error: any) {
    console.error("getBriefTemplates error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const createBriefTemplate = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const template = await storage.createBriefTemplate({ employerId, ...req.body });
    return res.status(201).json(template);
  } catch (error: any) {
    console.error("createBriefTemplate error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const deleteBriefTemplate = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const templateId = parseInt(req.params.templateId);
    if (isNaN(templateId)) return res.status(400).json({ error: "Invalid template ID" });
    await storage.deleteBriefTemplate(templateId, employerId);
    return res.json({ success: true });
  } catch (error: any) {
    console.error("deleteBriefTemplate error:", error.message);
    if (error.message === "Template not found or not owned by employer") {
      return res.status(404).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getBriefAttachmentUploadUrl = async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) return res.status(401).json({ error: "Unauthorised" });
    const { objectStorageService } = await import("../utils/object-storage.js");
    const uploadURL = await objectStorageService.getBriefAttachmentUploadURL();
    return res.json({ uploadURL });
  } catch (error: any) {
    console.error("getBriefAttachmentUploadUrl error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// 5.6 — Add attachment to a brief after upload
export const addBriefAttachment = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const bookingId = parseInt(req.params.bookingId);
    if (isNaN(bookingId)) return res.status(400).json({ error: "Invalid booking ID" });

    const brief = await storage.getBriefByBookingId(bookingId);
    if (!brief) return res.status(404).json({ error: "No brief found for this booking" });
    if (brief.employerId !== employerId) return res.status(403).json({ error: "Forbidden" });

    const { objectPath, originalFilename, fileType, fileSize } = req.body;
    if (!objectPath || !originalFilename || !fileType || !fileSize) {
      return res.status(400).json({ error: "Missing attachment fields" });
    }

    const attachment = await storage.addBriefAttachment({
      briefId: brief.id,
      objectPath,
      originalFilename,
      fileType,
      fileSize,
    });
    return res.status(201).json(attachment);
  } catch (error: any) {
    console.error("addBriefAttachment error:", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
