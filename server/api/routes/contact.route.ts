import type { Express } from "express";
import rateLimit from "express-rate-limit";
import { submitContactForm } from "../controllers/contact.controller";

// Rate limiter for contact form - max 3 submissions per 15 minutes per IP
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 3, // Limit each IP to 3 requests per windowMs
  message: { error: "Too many contact form submissions. Please try again later." },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skipSuccessfulRequests: false, // Count successful requests toward limit
});

export function registerContactRoutes(app: Express) {
  // Submit contact form
  app.post("/api/contact", contactLimiter, submitContactForm);
}
