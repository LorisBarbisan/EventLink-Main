import { insertRatingRequestSchema, insertRatingSchema } from "@shared/schema";
import type { Request, Response } from "express";
import { storage } from "../../storage";

// Create a rating
export async function createRating(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Derive recruiter_id from user if missing in body
    if (user.role === "recruiter" && !req.body.recruiter_id) {
      req.body.recruiter_id = user.id;
    }

    // Validate the rating data
    const result = insertRatingSchema.safeParse(req.body);
    if (!result.success) {
      console.warn("Rating validation failed:", result.error.format());
      return res.status(400).json({
        error: "Invalid input",
        details: result.error.issues,
      });
    }

    // 1. Check if rating already exists first
    const existingRating = await storage.getRatingByJobApplication(
      result.data.job_application_id
    );

    if (existingRating) {
      return res.status(409).json({
        error: "You have already submitted a rating for this application.",
      });
    }

    // 2. Check if recruiter can rate this freelancer (Permission & Status)
    const canRate = await storage.canRecruiterRateFreelancer(
      result.data.recruiter_id,
      result.data.freelancer_id,
      result.data.job_application_id
    );

    if (!canRate) {
      console.warn(`Rating blocked for application ${result.data.job_application_id}:`, {
        recruiter_id: result.data.recruiter_id,
        freelancer_id: result.data.freelancer_id
      });
      return res.status(403).json({
        error: "You are not authorized to rate this freelancer. The job must be marked as 'hired' and belong to you.",
      });
    }

    // Verify the recruiter_id matches the authenticated user
    if (user.role !== "admin" && user.id !== result.data.recruiter_id) {
      console.warn(`Unauthorized rating attempt: User ${user.id} tried to rate as ${result.data.recruiter_id}`);
      return res.status(403).json({ error: "Not authorized to create this rating" });
    }

    // Prepare notification data
    let notification: any = null;
    const application = await storage.getJobApplicationById(result.data.job_application_id);
    if (application) {
      const job = await storage.getJobById(application.job_id);
      notification = {
        user_id: result.data.freelancer_id,
        type: "rating_received",
        title: "New Rating Received",
        message: `You received a ${result.data.rating}-star rating for your work on "${job?.title || "a job"}".`,
        priority: "normal",
        related_entity_type: "rating",
        // related_entity_id will be set in storage transaction
        action_url: "/dashboard?tab=bookings",
        metadata: JSON.stringify({
          rating_id: 0, // Placeholder, updated in storage transaction
          rating_value: result.data.rating,
          job_id: application.job_id,
          job_title: job?.title,
        }),
      };
    }

    const rating = await storage.createRatingWithNotification(result.data, notification);

    res.status(201).json(rating);
  } catch (error) {
    console.error("Create rating error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}

// Get rating by job application ID
export async function getRatingByApplicationId(req: Request, res: Response) {
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
}

// Get all ratings for a freelancer
export async function getFreelancerRatings(req: Request, res: Response) {
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
}

// Get average rating for a freelancer
export async function getFreelancerAverageRating(req: Request, res: Response) {
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
}

// Create a rating request
export async function createRatingRequest(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user) {
      return res.status(401).json({ error: "Not authenticated" });
    }

    // Validate the rating request data
    const result = insertRatingRequestSchema.safeParse(req.body);
    if (!result.success) {
      console.warn("Rating request validation failed:", result.error.format());
      return res.status(400).json({
        error: "Invalid input",
        details: result.error.issues,
      });
    }

    // Verify the freelancer_id matches the authenticated user (only freelancers can request ratings)
    if (user.role !== "admin" && user.id !== result.data.freelancer_id) {
      console.warn(`Unauthorized rating request attempt: User ${user.id} tried to request as ${result.data.freelancer_id}`);
      return res.status(403).json({ error: "Not authorized to create this rating request" });
    }

    // Check if a rating request already exists for this application
    const existingRequest = await storage.getRatingRequestByJobApplication(
      result.data.job_application_id
    );
    if (existingRequest) {
      return res
        .status(400)
        .json({ error: "A rating request already exists for this application" });
    }

    // Check if the application exists and is hired
    const application = await storage.getJobApplicationById(result.data.job_application_id);
    if (!application) {
      return res.status(404).json({ error: "Application not found" });
    }

    if (application.status !== "hired") {
      return res.status(400).json({ error: "Can only request ratings for hired applications" });
    }

    // Prepare notification data
    let notification: any = null;
    const job = await storage.getJobById(application.job_id);
    if (job) {
      notification = {
        user_id: result.data.recruiter_id,
        type: "rating_request",
        title: "Rating Request",
        message: `A freelancer has requested a rating for their work on "${job.title}".`,
        priority: "normal",
        related_entity_type: "application",
        related_entity_id: application.id,
        action_url: "/dashboard?tab=applications",
        metadata: JSON.stringify({
          rating_request_id: 0, // Placeholder, updated in storage transaction
          job_id: job.id,
          job_title: job.title,
          freelancer_id: result.data.freelancer_id,
        }),
      };
    }

    const ratingRequest = await storage.createRatingRequestWithNotification(result.data, notification);

    res.status(201).json(ratingRequest);
  } catch (error) {
    console.error("Create rating request error:", error);
    res.status(500).json({
      error: "Internal server error",
      message: error instanceof Error ? error.message : "Unknown error"
    });
  }
}
