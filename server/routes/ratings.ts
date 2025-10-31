import type { Express } from "express";
import { storage } from "../storage";
import { insertRatingSchema, insertRatingRequestSchema } from "@shared/schema";
import { authenticateJWT } from "./auth";

export function registerRatingsRoutes(app: Express) {
  // Create a rating
  app.post("/api/ratings", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Validate the rating data
      const result = insertRatingSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid input", 
          details: result.error.issues 
        });
      }

      // Check if recruiter can rate this freelancer for this application
      const canRate = await storage.canRecruiterRateFreelancer(
        result.data.recruiter_id,
        result.data.freelancer_id,
        result.data.job_application_id
      );

      if (!canRate) {
        return res.status(403).json({ 
          error: "Cannot rate this freelancer. Either you're not authorized or a rating already exists for this application." 
        });
      }

      // Verify the recruiter_id matches the authenticated user
      if (req.user.role !== 'admin' && req.user.id !== result.data.recruiter_id) {
        return res.status(403).json({ error: "Not authorized to create this rating" });
      }

      const rating = await storage.createRating(result.data);

      // Create notification for freelancer
      const application = await storage.getJobApplicationById(result.data.job_application_id);
      if (application) {
        const job = await storage.getJobById(application.job_id);
        await storage.createNotification({
          user_id: result.data.freelancer_id,
          type: 'rating_received',
          title: 'New Rating Received',
          message: `You received a ${result.data.rating}-star rating for your work on "${job?.title || 'a job'}".`,
          priority: 'normal',
          related_entity_type: 'rating',
          related_entity_id: rating.id,
          action_url: '/dashboard?tab=bookings',
          metadata: JSON.stringify({ 
            rating_id: rating.id,
            rating_value: result.data.rating,
            job_id: application.job_id,
            job_title: job?.title
          })
        });
      }

      res.status(201).json(rating);
    } catch (error) {
      console.error("Create rating error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get rating by job application ID
  app.get("/api/ratings/:applicationId", authenticateJWT, async (req, res) => {
    try {
      const applicationId = parseInt(req.params.applicationId);

      if (Number.isNaN(applicationId)) {
        return res.status(400).json({ error: "Invalid application ID" });
      }

      const rating = await storage.getRatingByJobApplication(applicationId);
      
      if (!rating) {
        return res.status(404).json({ error: "Rating not found" });
      }

      res.json(rating);
    } catch (error) {
      console.error("Get rating error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get all ratings for a freelancer
  app.get("/api/ratings/freelancer/:freelancerId", async (req, res) => {
    try {
      const freelancerId = parseInt(req.params.freelancerId);

      if (Number.isNaN(freelancerId)) {
        return res.status(400).json({ error: "Invalid freelancer ID" });
      }

      const ratings = await storage.getFreelancerRatings(freelancerId);
      res.json(ratings);
    } catch (error) {
      console.error("Get freelancer ratings error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Get average rating for a freelancer
  app.get("/api/ratings/freelancer/:freelancerId/average", async (req, res) => {
    try {
      const freelancerId = parseInt(req.params.freelancerId);

      if (Number.isNaN(freelancerId)) {
        return res.status(400).json({ error: "Invalid freelancer ID" });
      }

      const averageRating = await storage.getFreelancerAverageRating(freelancerId);
      res.json(averageRating);
    } catch (error) {
      console.error("Get average rating error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // Create a rating request
  app.post("/api/rating-requests", authenticateJWT, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      // Validate the rating request data
      const result = insertRatingRequestSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).json({ 
          error: "Invalid input", 
          details: result.error.issues 
        });
      }

      // Verify the freelancer_id matches the authenticated user (only freelancers can request ratings)
      if (req.user.role !== 'admin' && req.user.id !== result.data.freelancer_id) {
        return res.status(403).json({ error: "Not authorized to create this rating request" });
      }

      // Check if a rating request already exists for this application
      const existingRequest = await storage.getRatingRequestByJobApplication(result.data.job_application_id);
      if (existingRequest) {
        return res.status(400).json({ error: "A rating request already exists for this application" });
      }

      // Check if the application exists and is hired
      const application = await storage.getJobApplicationById(result.data.job_application_id);
      if (!application) {
        return res.status(404).json({ error: "Application not found" });
      }

      if (application.status !== 'hired') {
        return res.status(400).json({ error: "Can only request ratings for hired applications" });
      }

      const ratingRequest = await storage.createRatingRequest(result.data);

      // Create notification for recruiter
      const job = await storage.getJobById(application.job_id);
      if (job) {
        await storage.createNotification({
          user_id: result.data.recruiter_id,
          type: 'rating_request',
          title: 'Rating Request',
          message: `A freelancer has requested a rating for their work on "${job.title}".`,
          priority: 'normal',
          related_entity_type: 'application',
          related_entity_id: application.id,
          action_url: '/dashboard?tab=applications',
          metadata: JSON.stringify({ 
            rating_request_id: ratingRequest.id,
            job_id: job.id,
            job_title: job.title,
            freelancer_id: result.data.freelancer_id
          })
        });
      }

      res.status(201).json(ratingRequest);
    } catch (error) {
      console.error("Create rating request error:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });
}
