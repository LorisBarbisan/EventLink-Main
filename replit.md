# EventLink - Freelance Marketplace

## Overview

EventLink is a freelance marketplace platform tailored for the events industry, connecting event professionals (freelancers) with employers and companies. Its primary purpose is to streamline the hiring process for event staff by providing detailed profiles, job posting capabilities, and integrated communication tools. The platform aims to be a leading solution for event staffing needs.

## User Preferences

- Security-focused development with proper client/server separation
- Modern web application patterns with backend handling data persistence
- Minimal file structure with consolidated components where appropriate
- Maximum system efficiency and performance optimization

## System Architecture

The EventLink platform utilizes a modern web application stack designed for efficiency and performance.

### UI/UX Decisions

- **Styling**: Tailwind CSS for utility-first styling.
- **Components**: shadcn/ui for consistent and accessible UI components.
- **Responsive Design**: Mobile-first approach with responsive breakpoints. Dashboards use 2-column tab layout on mobile (expanding to 4 columns on larger screens), card layouts stack vertically on mobile with full-width buttons, and flexible grid systems adapt from single column on mobile to multi-column on desktop.

### Technical Implementations

- **Frontend**: React and TypeScript with Wouter for client-side routing.
- **Backend**: Express.js and TypeScript, providing a comprehensive API layer.
- **Database**: PostgreSQL with Drizzle ORM. The schema has been optimized to unify profile tables, simplify messaging, streamline job handling, and improve notification efficiency.
- **Authentication**: Custom session management with `localStorage` persistence, requiring email verification. Robust server-side validation and cache clearing mechanisms are implemented to prevent authentication race conditions and ensure immediate password reset/change efficacy. Social login (Google, Facebook, LinkedIn) UI has been removed from sign-in and sign-up pages - authentication is email/password only. **Role Validation**: Implemented defense-in-depth role checking - backend blocks authentication for users with missing/invalid roles (via `computeUserRole` throwing errors), and frontend validates roles explicitly before rendering dashboards to prevent wrong dashboard display.
- **Messaging System**: Refactored to a production-ready fetch-first pattern using React Query for messages, ensuring atomic operations via database transactions and eliminating race conditions. WebSocket integration provides real-time updates.
- **Real-Time WebSocket System**: Centralized WebSocket architecture with single shared connection managed by WebSocketProvider. Features include automatic reconnection, message deduplication, connection state management, and subscriber pattern for component-level event handling. WebSocket service layer (`websocketService.ts`) handles all broadcast operations, maintaining separation from storage layer. Supports real-time events for messages, notifications, and badge count updates. CSP (Content Security Policy) configured to allow WebSocket connections on all deployment domains: localhost (development), Replit domains (*.replit.dev, *.replit.app), and custom domain (eventlink.one).

### Feature Specifications

- **Optimized Database Schema**: Significant reduction in database complexity through table unification and streamlined data models. Indexes added on freelancer_profiles(title, location, availability_status) for search performance.
- **Optimized Backend**: Simplified API endpoints and a unified interface for improved performance.
- **Optimized Frontend**: Streamlined authentication and version-based cache clearing to prevent deployment issues.
- **Job Management**: Simplified job posting form focused on "gig" type jobs, including mandatory start dates and optional end dates/times.
- **Application Management**: Enhanced display of job applications for both freelancers and employers, ensuring all relevant job details are visible.
- **Email Service Diagnostics**: An internal endpoint `/api/debug/email-connector` is available for troubleshooting SendGrid connectivity.
- **Job Search & Filtering**: Comprehensive server-side search system with keyword, location, and date range filters. EventLink jobs are prioritized above external jobs, with visual distinction badges ("EventLink Opportunity" vs. "External • [source]").
- **Freelancer Search ("Find Crew")**: Server-side search with weighted relevance scoring (40% title, 30% skills, 20% bio, 10% rating), pagination (20 results/page), keyword/location filters, and rating integration. Performance optimized with database indexes achieving <400ms response time.
- **Email Notification System**: Comprehensive notification system with user-configurable preferences via dedicated settings page accessible from account dropdown. Supports role-based notifications (freelancers vs. employers) including message alerts, application updates, job alerts with filters, and rating requests. Branded email templates with EventLink orange gradient (#D8690E) and full logging for debugging and reliability tracking. Email addressing logic prioritises company name (from Settings) for employers, falling back to user's full name, then email. **Note: Currently blocked by SendGrid account credit limitations.**
- **Job Social Sharing & Rich Link Previews**: Employers can share active jobs via a Share button (copy link, LinkedIn, WhatsApp, Facebook, Email). Server-side OG tag injection middleware serves rich previews to social media crawlers (LinkedIn, Facebook, WhatsApp, X) with job title, company, location, rate, and dates. Public job detail page at `/jobs/:id` allows non-logged-in users to view and sign in to apply. Privacy controls ensure only active jobs are shareable; private/closed/deleted jobs show appropriate messages. Foundational analytics via `job_link_views` table tracks link views with source attribution.
- **Job Auto-Expiry**: Jobs whose `event_date` has passed are automatically set to "closed" status when the employer views their dashboard, and are excluded from the Find Jobs page. Expired jobs show an "Expired" badge with "Event date passed" label in the employer dashboard. User-facing terminology uses "Employer" instead of "Recruiter" while internal code identifiers remain unchanged.

## External Dependencies

- **PostgreSQL**: The primary relational database for all application data.
- **SendGrid**: Used for sending transactional emails, primarily for user verification and notifications.
- **Tailwind CSS**: A utility-first CSS framework for styling the application.
- **shadcn/ui**: A collection of re-usable components built using Radix UI and Tailwind CSS.
- **Wouter**: A lightweight client-side routing library for React.
- **pdf-parse**: Library for extracting text content from PDF files for CV parsing.

### Feature Specifications (Continued)

- **CV Parsing & Automatic Profile Population**: Freelancers can upload their CV (PDF) and the system automatically extracts key information (name, title, skills, bio, location, experience years, education, work history, certifications) using AI-powered parsing via Replit's OpenAI integration (gpt-5-mini model), with fallback to rule-based parsing. Extracted data is presented in a review step with "Suggested from CV" badges. Users can select which fields to apply to their profile, edit individual suggestions, or dismiss all. The parsing happens asynchronously in the background, with status updates shown in real-time. Re-uploading a CV triggers fresh parsing. Privacy: CV content is not exposed publicly; parsed data is stored in draft state until confirmed. CV upload is prominently displayed at the top of the profile form with clear messaging about auto-population.
