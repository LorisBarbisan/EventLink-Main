// ============================================================
// FMS Phase 2 — Availability Enquiry Controller
// File: server/api/controllers/enquiry.controller.ts
// ============================================================

import { Request, Response } from "express";
import { storage } from "../../storage";

// 4.1 — Create enquiry and dispatch emails to selected freelancers
export const createEnquiry = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });

    const { freelancerIds, ...enquiryData } = req.body;
    if (!freelancerIds?.length) {
      return res.status(400).json({ error: "Select at least one freelancer" });
    }

    const { enquiry, responses } = await storage.createEnquiryWithResponses({
      employerId,
      ...enquiryData,
      freelancerIds,
    });

    const employer = await storage.getRecruiterProfile(employerId);
    const employerName = employer?.company_name ?? "An employer";
    const baseUrl = req.protocol + "://" + req.get("host");

    const { sendEmail } = await import("../utils/emailService.js");
    const { generateAvailabilityEnquiryEmail } = await import("../utils/emailTemplates.js");

    await Promise.allSettled(
      responses.map(async (resp) => {
        const user = await storage.getUser(resp.freelancerId);
        if (!user?.email) return;
        const profile = await storage.getFreelancerProfile(resp.freelancerId);
        const firstName =
          (profile as any)?.first_name ?? (user as any).firstName ?? "there";
        const { html } = generateAvailabilityEnquiryEmail({
          freelancerFirstName: firstName,
          employerName,
          eventTitle: enquiry.eventTitle,
          eventDate: enquiry.eventDate,
          callTime: enquiry.callTime,
          venueAddress: enquiry.venueAddress,
          roleRequired: enquiry.roleRequired,
          agreedRate: enquiry.agreedRate,
          additionalNotes: enquiry.additionalNotes,
          responseToken: resp.token,
          baseUrl,
        });
        await sendEmail({
          to: user.email,
          subject: `Availability check: ${enquiry.eventTitle} on ${enquiry.eventDate}`,
          html,
        });
      })
    );

    return res.status(201).json({ enquiry, responses });
  } catch (error) {
    console.error("createEnquiry error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// 4.2 — List all enquiries for the authenticated employer
export const getEnquiriesForEmployer = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const enquiries = await storage.getEnquiriesForEmployer(employerId);
    return res.json(enquiries);
  } catch (error) {
    console.error("getEnquiriesForEmployer error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// 4.3 — Get full response detail for a specific enquiry
export const getEnquiryResponses = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const enquiryId = parseInt(req.params.id);
    if (isNaN(enquiryId))
      return res.status(400).json({ error: "Invalid enquiry ID" });
    const result = await storage.getEnquiryResponses(enquiryId, employerId);
    if (!result) return res.status(404).json({ error: "Enquiry not found" });
    return res.json(result);
  } catch (error) {
    console.error("getEnquiryResponses error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// 4.4 — Public endpoint: freelancer responds via email link or form
export const respondToEnquiry = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const response = (req.query.r ?? req.body.response) as string;
    const note = req.body.note as string | undefined;

    if (!["yes", "no", "maybe"].includes(response)) {
      return res.status(400).json({ error: "Invalid response value" });
    }

    const updated = await storage.recordAvailabilityResponse(
      token,
      response as "yes" | "no" | "maybe",
      note
    );
    if (!updated) return res.status(404).json({ error: "Response token not found" });

    if (req.query.r) {
      return res.redirect(`/availability/responded?r=${response}`);
    }
    return res.json({ success: true, response: updated });
  } catch (error) {
    console.error("respondToEnquiry error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// 4.4b — Public endpoint: load event details by token (for the response page)
export const getResponseByTokenHandler = async (req: Request, res: Response) => {
  try {
    const { token } = req.params;
    const row = await storage.getResponseByToken(token);
    if (!row) return res.status(404).json({ error: "Token not found" });
    const { response: resp, enquiry, user } = row;
    return res.json({
      response: {
        id: resp.id,
        response: resp.response,
        respondedAt: resp.respondedAt,
        responseNote: resp.responseNote,
      },
      enquiry: {
        id: enquiry.id,
        eventTitle: enquiry.eventTitle,
        eventDate: enquiry.eventDate,
        eventEndDate: enquiry.eventEndDate,
        callTime: enquiry.callTime,
        venueAddress: enquiry.venueAddress,
        roleRequired: enquiry.roleRequired,
        agreedRate: enquiry.agreedRate,
        additionalNotes: enquiry.additionalNotes,
        status: enquiry.status,
      },
      freelancer: { firstName: user.firstName },
    });
  } catch (error) {
    console.error("getResponseByTokenHandler error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
};

// 4.5 — Convert a "yes" response into a confirmed booking
export const convertResponseToBooking = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: "Unauthorised" });
    const enquiryId = parseInt(req.params.id);
    const responseId = parseInt(req.params.responseId);
    if (isNaN(enquiryId) || isNaN(responseId)) {
      return res.status(400).json({ error: "Invalid ID" });
    }
    const booking = await storage.convertResponseToBooking(responseId, employerId);
    return res.status(201).json(booking);
  } catch (error: any) {
    console.error("convertResponseToBooking error:", error);
    if (error.message === "Already converted to a booking") {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: "Internal server error" });
  }
};
