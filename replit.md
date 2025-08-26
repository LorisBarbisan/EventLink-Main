# EventLink - Replit Migration

## Overview
EventLink is a freelance marketplace platform specifically designed for the events industry. It connects event professionals (freelancers) with recruiters/companies seeking skilled crew members. The platform aims to streamline the hiring process for event staff, offering detailed profiles, job posting capabilities, and integrated communication tools.

## User Preferences
- Security-focused development with proper client/server separation
- Modern web application patterns with backend handling data persistence
- Minimal file structure with consolidated components where appropriate

## System Architecture
The EventLink platform utilizes a modern web application stack.
- **Frontend**: Developed with React and TypeScript, leveraging Wouter for efficient client-side routing. UI components are built using Tailwind CSS and shadcn/ui to ensure a consistent and responsive design.
- **Backend**: Implemented with Express.js and TypeScript, handling API requests, business logic, and database interactions.
- **Database**: PostgreSQL is used as the primary data store, with Drizzle ORM managing database schema and queries.
- **Authentication**: A custom, JWT-less session management system is employed, utilizing `localStorage` for session persistence.
- **UI/UX Decisions**: The platform features a blue/purple gradient design reflecting the EventLink brand. Dashboards are tabbed for clear navigation, with distinct layouts for freelancers and recruiters. Forms utilize progressive disclosure for a guided user experience. Key features include comprehensive profile management for both user types, a job posting system with dynamic fields, a smart notification system, and an integrated messaging interface. Image and logo uploads include client-side compression. Security is paramount, with server-side input validation, robust authentication, and memory leak prevention in WebSocket communications.

## External Dependencies
The project aims for minimal external dependencies, focusing on core technologies.
- **PostgreSQL**: Relational database for data storage.
- **Tailwind CSS**: Utility-first CSS framework for styling.
- **shadcn/ui**: Component library built on Tailwind CSS for UI elements.
- **Wouter**: Lightweight client-side router for React applications.
- No third-party authentication services, external storage solutions (like Supabase), or complex API integrations are used beyond standard web functionalities.