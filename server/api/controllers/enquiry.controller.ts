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
    console.error("createEnquiry FULL ERROR:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
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

// 4.6 — Cancel an entire enquiry
export const cancelEnquiry = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: 'Unauthorised' });
    const enquiryId = parseInt(req.params.id);
    if (isNaN(enquiryId)) return res.status(400).json({ error: 'Invalid enquiry ID' });
    const { enquiry, freelancerIds } = await storage.cancelEnquiry(enquiryId, employerId);
    const employer = await storage.getRecruiterProfile(employerId);
    const employerName = employer?.company_name ?? 'An employer';
    const { sendEmail } = await import('../utils/emailService.js');
    const { generateEnquiryCancelledEmail } = await import('../utils/emailTemplates.js');
    await Promise.allSettled(freelancerIds.map(async (fId) => {
      const user = await storage.getUser(fId);
      if (!user?.email) return;
      const profile = await storage.getFreelancerProfile(fId);
      const firstName = (profile as any)?.first_name ?? user.first_name ?? 'there';
      const html = generateEnquiryCancelledEmail({
        freelancerFirstName: firstName,
        employerName,
        eventTitle: enquiry.eventTitle,
        eventDate: enquiry.eventDate,
      });
      await sendEmail({
        to: user.email,
        subject: `Availability check cancelled: ${enquiry.eventTitle}`,
        html,
      });
    }));
    return res.json({ success: true, enquiry });
  } catch (error: any) {
    console.error('cancelEnquiry error:', error.message, error.stack);
    if (error.message === 'Enquiry already closed') {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 4.7 — Update editable fields on an active enquiry
export const updateEnquiry = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: 'Unauthorised' });
    const enquiryId = parseInt(req.params.id);
    if (isNaN(enquiryId)) return res.status(400).json({ error: 'Invalid enquiry ID' });
    const { enquiry, significantChange, freelancerIds } =
      await storage.updateEnquiryDetails(enquiryId, employerId, req.body);
    if (significantChange && freelancerIds.length > 0) {
      const employer = await storage.getRecruiterProfile(employerId);
      const employerName = employer?.company_name ?? 'An employer';
      const baseUrl = req.protocol + '://' + req.get('host');
      const { sendEmail } = await import('../utils/emailService.js');
      const { generateEnquiryUpdatedEmail } = await import('../utils/emailTemplates.js');
      const responses = await storage.getEnquiryResponses(enquiryId, employerId);
      await Promise.allSettled(freelancerIds.map(async (fId) => {
        const user = await storage.getUser(fId);
        if (!user?.email) return;
        const profile = await storage.getFreelancerProfile(fId);
        const firstName = (profile as any)?.first_name ?? user.first_name ?? 'there';
        const respRow = responses?.responses?.find(
          (r: any) => r.response.freelancerId === fId
        );
        if (!respRow) return;
        const html = generateEnquiryUpdatedEmail({
          freelancerFirstName: firstName,
          employerName,
          eventTitle: enquiry.eventTitle,
          eventDate: enquiry.eventDate,
          eventEndDate: enquiry.eventEndDate,
          callTime: enquiry.callTime,
          venueAddress: enquiry.venueAddress,
          responseToken: respRow.response.token,
          baseUrl,
        });
        await sendEmail({
          to: user.email,
          subject: `Updated details: ${enquiry.eventTitle} on ${enquiry.eventDate}`,
          html,
        });
      }));
    }
    return res.json({ success: true, enquiry, emailsSent: significantChange });
  } catch (error: any) {
    console.error('updateEnquiry error:', error.message, error.stack);
    if (error.message === 'Cannot edit a closed enquiry' || error.message === 'Enquiry not found or not owned by employer') {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 4.8 — Add freelancers to an existing active enquiry
export const addFreelancers = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: 'Unauthorised' });
    const enquiryId = parseInt(req.params.id);
    if (isNaN(enquiryId)) return res.status(400).json({ error: 'Invalid enquiry ID' });
    const { freelancerIds } = req.body;
    if (!freelancerIds?.length) {
      return res.status(400).json({ error: 'No freelancer IDs provided' });
    }
    const { enquiry, newResponses } =
      await storage.addFreelancersToEnquiry(enquiryId, employerId, freelancerIds);
    if (newResponses.length === 0) {
      return res.json({ success: true, message: 'All freelancers already on enquiry', newResponses: [] });
    }
    const employer = await storage.getRecruiterProfile(employerId);
    const employerName = employer?.company_name ?? 'An employer';
    const baseUrl = req.protocol + '://' + req.get('host');
    const { sendEmail } = await import('../utils/emailService.js');
    const { generateAvailabilityEnquiryEmail } = await import('../utils/emailTemplates.js');
    await Promise.allSettled(newResponses.map(async (resp) => {
      const user = await storage.getUser(resp.freelancerId);
      if (!user?.email) return;
      const profile = await storage.getFreelancerProfile(resp.freelancerId);
      const firstName = (profile as any)?.first_name ?? user.first_name ?? 'there';
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
    }));
    return res.status(201).json({ success: true, newResponses });
  } catch (error: any) {
    console.error('addFreelancers error:', error.message, error.stack);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 4.9 — Remove a single freelancer from an active enquiry
export const removeFreelancer = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: 'Unauthorised' });
    const enquiryId = parseInt(req.params.id);
    const freelancerId = parseInt(req.params.freelancerId);
    if (isNaN(enquiryId) || isNaN(freelancerId)) {
      return res.status(400).json({ error: 'Invalid ID' });
    }
    const { enquiry, removedResponse } =
      await storage.removeFreelancerFromEnquiry(enquiryId, employerId, freelancerId);
    const user = await storage.getUser(freelancerId);
    if (user?.email) {
      const employer = await storage.getRecruiterProfile(employerId);
      const employerName = employer?.company_name ?? 'An employer';
      const { sendEmail } = await import('../utils/emailService.js');
      const { generateEnquiryRemovedEmail } = await import('../utils/emailTemplates.js');
      const profile = await storage.getFreelancerProfile(freelancerId);
      const firstName = (profile as any)?.first_name ?? user.first_name ?? 'there';
      const html = generateEnquiryRemovedEmail({
        freelancerFirstName: firstName,
        employerName,
        eventTitle: enquiry.eventTitle,
        eventDate: enquiry.eventDate,
      });
      await sendEmail({
        to: user.email,
        subject: `Availability check withdrawn: ${enquiry.eventTitle}`,
        html,
      });
    }
    return res.json({ success: true });
  } catch (error: any) {
    console.error('removeFreelancer error:', error.message, error.stack);
    if (error.message === 'Cannot remove a freelancer who has been booked') {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 4.10 — Archive a closed enquiry
export const archiveEnquiry = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: 'Unauthorised' });
    const enquiryId = parseInt(req.params.id);
    if (isNaN(enquiryId)) return res.status(400).json({ error: 'Invalid enquiry ID' });
    const enquiry = await storage.archiveEnquiry(enquiryId, employerId);
    return res.json({ success: true, enquiry });
  } catch (error: any) {
    console.error('archiveEnquiry error:', error.message, error.stack);
    if (error.message === 'Close the enquiry before archiving' || error.message === 'Enquiry already archived') {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 4.11 — Reactivate an archived enquiry
export const reactivateEnquiry = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: 'Unauthorised' });
    const enquiryId = parseInt(req.params.id);
    if (isNaN(enquiryId)) return res.status(400).json({ error: 'Invalid enquiry ID' });
    const enquiry = await storage.reactivateEnquiry(enquiryId, employerId);
    return res.json({ success: true, enquiry });
  } catch (error: any) {
    console.error('reactivateEnquiry error:', error.message, error.stack);
    if (error.message === 'Only archived enquiries can be reactivated') {
      return res.status(409).json({ error: error.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// 4.12 — List archived enquiries for employer
export const getArchivedEnquiries = async (req: Request, res: Response) => {
  try {
    const employerId = req.user?.id;
    if (!employerId) return res.status(401).json({ error: 'Unauthorised' });
    const enquiries = await storage.getArchivedEnquiries(employerId);
    return res.json(enquiries);
  } catch (error: any) {
    console.error('getArchivedEnquiries error:', error.message, error.stack);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
