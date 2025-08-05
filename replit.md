# Event Crew - Replit Migration

## Project Overview
Event Crew is a freelancer marketplace platform specifically designed for the events industry. The platform connects event professionals (freelancers) with recruiters/companies looking for skilled crew members.

## Architecture
- **Frontend**: React with TypeScript, using Wouter for routing
- **Backend**: Express.js with TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Custom JWT-less session management using localStorage
- **UI**: Tailwind CSS with shadcn/ui components

## Data Model
- **Users**: Basic user information with email, password, and role (freelancer/recruiter)
- **Freelancer Profiles**: Detailed professional profiles with skills, rates, availability
- **Recruiter Profiles**: Company information and contact details

## Recent Changes
### August 5, 2025
- **User Profile Display Fix**: Fixed account dashboard to display actual user names instead of just email addresses
- **Enhanced Profile Management**: Created useProfile hook to fetch complete user profile data for both freelancers and recruiters
- **Avatar Improvements**: Updated avatar initials to use actual names when available, with intelligent fallbacks
- **Currency Symbol Standardization**: Replaced all dollar signs ($) with unmarked coin symbols (¤) while preserving British pound (£) symbols
- **Icon Updates**: Updated all DollarSign imports to Coins throughout the platform

### August 4, 2025
- **Recruiter Multi-Tab Dashboard**: Complete redesign of recruiter dashboard with 4 main tabs (Company Profile, My Jobs, Messages, Applications)
- **Job Posting System**: Added comprehensive job posting functionality with form validation and management
- **Profile Management**: Full recruiter profile creation and editing with company information, contact details, and branding
- **Database Validation Fix**: Resolved user_id type validation error in recruiter profile creation
- **Settings Page**: Comprehensive settings page with account management, notifications, privacy controls, and account deletion
- **Account Management**: Enhanced dropdown menu with functioning Settings navigation

### February 3, 2025
- **Tabbed Dashboard Interface**: Complete redesign of freelancer dashboard with 4 main tabs (Edit Profile, Messages, Jobs, Bookings)
- **Account Menu**: Added professional dropdown account menu with avatar, profile links, and sign-out functionality
- **Sample Data Integration**: Populated all dashboard tabs with realistic sample data for full UI inspection
- **Enhanced Navigation**: Improved user experience with proper authentication redirects and account management

### February 2, 2025
- **Fixed Gradient Text Issues**: Resolved rendering problems across all pages with gradient backgrounds  
- **Enhanced Password Validation**: Added comprehensive signup form validation with real-time feedback
- **Fixed Routing Issues**: Corrected NotFound component appearing at bottom of all pages using Switch component
- **Profile Photo Upload**: Added photo upload functionality to FreelancerDashboard with image compression
- **Company Logo Upload**: Added logo upload functionality to RecruiterDashboard with image compression  
- **Fixed Data Validation**: Corrected user_id and hourly_rate type mismatches in profile saving
- **Increased Payload Limit**: Set Express server to handle 10MB payloads for image uploads
- **Image Optimization**: Implemented client-side image compression to reduce file sizes

### February 1, 2025
- **Navigation System Complete**: Fixed all landing page buttons to navigate to proper pages
- **Created Jobs Page**: Full job listing page with search, filters, and EventCrew design
- **Created Freelancers Page**: Comprehensive crew search page with profiles and skills
- **Updated Routing**: Added /jobs and /freelancers routes to main application
- **Fixed Authentication Flow**: Resolved error messages and redirect issues during login
- **Rate Toggle Feature**: Added hourly/daily rate selector in freelancer dashboard

### January 30, 2025
- **EventCrew UI Design Complete**: Applied complete EventCrew branding with blue/purple gradient design
- **Updated Hero Image**: Replaced with corporate event presentation image showing professional AV setup
- **Color Scheme Enhancement**: "Technical" in blue, "Crew" in purple matching EventCrew brand
- **Professional Event Focus**: Updated visuals to showcase corporate presentations and technical events

### January 24, 2025
- **Migration from Lovable to Replit**: Successfully migrated the entire codebase from Supabase to Replit's PostgreSQL environment
- **Removed Supabase dependencies**: Eliminated all @supabase/supabase-js dependencies and related code
- **Implemented custom authentication**: Created server-side authentication system with bcrypt password hashing
- **Database schema migration**: Converted from Supabase tables to Drizzle schema with PostgreSQL
- **Router migration**: Switched from react-router-dom to wouter for client-side routing
- **API endpoints**: Implemented RESTful API endpoints for user management and profile operations

## User Preferences
- Security-focused development with proper client/server separation
- Modern web application patterns with backend handling data persistence
- Minimal file structure with consolidated components where appropriate

## Current Status
The application has been successfully migrated from Lovable/Supabase to Replit environment with:
- Working authentication system
- Database operations through Drizzle ORM
- Complete removal of external dependencies like Supabase
- Ready for deployment and further development