import type { Express } from "express";
import {
  acceptApplication,
  applyToJob,
  deleteApplication,
  getFreelancerApplications,
  getFreelancerBookings,
  getJobApplications,
  getRecruiterApplications,
  getRecruiterHiddenApplications,
  inviteFreelancer,
  rejectApplication,
  respondToInvitation,
  withdrawInvitation,
} from "../controllers/applications.controller";
import { authenticateJWT } from "../middleware/auth.middleware";
import { resolveCompanyId } from "../middleware/team.middleware";

export function registerApplicationRoutes(app: Express) {
  // Respond to invitation (Accept/Decline)
  app.post("/api/applications/:applicationId/respond", authenticateJWT, respondToInvitation);

  // Invite freelancer to apply
  app.post("/api/applications/invite", authenticateJWT, resolveCompanyId, inviteFreelancer);

  // Get freelancer bookings (accepted applications)
  app.get("/api/freelancer/:freelancerId/bookings", authenticateJWT, getFreelancerBookings);

  // Apply to job
  app.post("/api/jobs/:jobId/apply", authenticateJWT, applyToJob);

  // Get freelancer applications
  app.get("/api/freelancer/:freelancerId/applications", authenticateJWT, getFreelancerApplications);

  // Get applications for a job
  app.get("/api/jobs/:jobId/applications", authenticateJWT, resolveCompanyId, getJobApplications);

  // Get recruiter applications
  app.get(
    "/api/recruiter/:recruiterId/applications",
    authenticateJWT,
    resolveCompanyId,
    getRecruiterApplications
  );

  // Get recruiter's hidden applications (live jobs only)
  app.get(
    "/api/recruiter/:recruiterId/applications/hidden",
    authenticateJWT,
    resolveCompanyId,
    getRecruiterHiddenApplications
  );

  // Accept application
  app.put(
    "/api/applications/:applicationId/accept",
    authenticateJWT,
    resolveCompanyId,
    acceptApplication
  );

  // Reject application
  app.put(
    "/api/applications/:applicationId/reject",
    authenticateJWT,
    resolveCompanyId,
    rejectApplication
  );

  // Withdraw an invitation (employer only)
  app.delete(
    "/api/applications/:applicationId/invite",
    authenticateJWT,
    resolveCompanyId,
    withdrawInvitation
  );

  // Delete application (soft delete with role-based permissions)
  app.delete(
    "/api/applications/:applicationId",
    authenticateJWT,
    resolveCompanyId,
    deleteApplication
  );
}
