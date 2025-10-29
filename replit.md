# EventLink - Freelance Marketplace

## Overview
EventLink is a freelance marketplace platform tailored for the events industry, connecting event professionals (freelancers) with recruiters and companies. Its primary purpose is to streamline the hiring process for event staff by providing detailed profiles, job posting capabilities, and integrated communication tools. The platform aims to be a leading solution for event staffing needs.

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

### Technical Implementations
- **Frontend**: React and TypeScript with Wouter for client-side routing.
- **Backend**: Express.js and TypeScript, providing a comprehensive API layer.
- **Database**: PostgreSQL with Drizzle ORM. The schema has been optimized to unify profile tables, simplify messaging, streamline job handling, and improve notification efficiency.
- **Authentication**: Custom session management with `localStorage` persistence, requiring email verification. Robust server-side validation and cache clearing mechanisms are implemented to prevent authentication race conditions and ensure immediate password reset/change efficacy.
- **Messaging System**: Refactored to a production-ready fetch-first pattern using React Query for messages, ensuring atomic operations via database transactions and eliminating race conditions. WebSocket integration provides real-time updates.

### Feature Specifications
- **Optimized Database Schema**: Significant reduction in database complexity through table unification and streamlined data models.
- **Optimized Backend**: Simplified API endpoints and a unified interface for improved performance.
- **Optimized Frontend**: Streamlined authentication and version-based cache clearing to prevent deployment issues.
- **Job Management**: Simplified job posting form focused on "gig" type jobs, including mandatory start dates and optional end dates/times.
- **Application Management**: Enhanced display of job applications for both freelancers and recruiters, ensuring all relevant job details are visible.
- **Email Service Diagnostics**: An internal endpoint `/api/debug/email-connector` is available for troubleshooting SendGrid connectivity.

## External Dependencies
- **PostgreSQL**: The primary relational database for all application data.
- **SendGrid**: Used for sending transactional emails, primarily for user verification and notifications.
- **Tailwind CSS**: A utility-first CSS framework for styling the application.
- **shadcn/ui**: A collection of re-usable components built using Radix UI and Tailwind CSS.
- **Wouter**: A lightweight client-side routing library for React.