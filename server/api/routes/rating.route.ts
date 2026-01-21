import type { Express } from "express";
import {
  createRating,
  createRatingRequest,
  getAdminRatings,
  getFreelancerAverageRating,
  getFreelancerRatings,
  getRatingByApplicationId,
  moderationAction,
  reportRating,
} from "../controllers/rating.controller";
import { authenticateJWT } from "../middleware/auth.middleware";

export function registerRatingsRoutes(app: Express) {
  // Create a rating
  app.post("/api/ratings", authenticateJWT, createRating);

  // Admin: Get all ratings for moderation (Must constitute before /:applicationId to prevent collision)
  app.get("/api/ratings/admin", authenticateJWT, getAdminRatings);

  // Get rating by job application ID
  app.get("/api/ratings/:applicationId", authenticateJWT, getRatingByApplicationId);

  // Get all ratings for a freelancer
  app.get("/api/ratings/freelancer/:freelancerId", getFreelancerRatings);

  // Get average rating for a freelancer
  app.get("/api/ratings/freelancer/:freelancerId/average", getFreelancerAverageRating);

  // Create a rating request
  app.post("/api/rating-requests", authenticateJWT, createRatingRequest);

  // Report a rating
  app.post("/api/ratings/:ratingId/report", authenticateJWT, reportRating);

  // Admin: Moderate a rating
  app.post("/api/ratings/:ratingId/moderate", authenticateJWT, moderationAction);
}
