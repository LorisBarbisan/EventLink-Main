# E8 - Replit Migration

## Project Overview
E8 is a freelancer marketplace platform specifically designed for the events industry. The platform connects event professionals (freelancers) with recruiters/companies looking for skilled crew members.

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
### August 21, 2025 (Latest)
- **Hired Applicants Display**: Implemented expandable hired applicants section in recruiter's "My Jobs" tab
  - Shows green "hired" badge on job cards when freelancers are hired for that position
  - Expandable details reveal hired freelancer profiles with rates, titles, and contact information
  - Direct links to freelancer profiles and messaging functionality from hired applicants view
  - Visual distinction with green styling to highlight successful hires
- **Application Decline Bug Fix**: Fixed critical issue where declined applications disappeared from recruiter dashboard
- **API Integration**: Implemented proper API call to `/api/applications/:id/reject` when declining applications
- **UI Enhancement**: Added status indicators for declined and hired applications to remain visible in dashboard
- **Cache Management**: Added query invalidation to refresh applications list after status changes
- **Error Handling**: Added proper error handling and user feedback for application decline operations
- **Messaging Integration**: Added automatic notification messages to freelancers when applications are declined
- **Favicon Update**: Added E8 logo as favicon for the application
- **Smart Notification System**: Implemented red notification dots that appear/disappear based on tab viewing behavior
  - Applications tab: Shows red dot for new pending applications until viewed
  - Jobs tab (freelancer): Shows red dot for declined/hired application updates until viewed
  - Messages tab: Shows red dot for unread messages across both dashboards
  - Persistent tracking using localStorage to maintain notification state across browser sessions

### August 20, 2025
- **Comprehensive Security Audit & Bug Fixes**: Identified and resolved critical security vulnerabilities and performance issues
  - **Authentication Security**: Added input validation for signin endpoint to prevent injection attacks and improved error handling
  - **WebSocket Memory Leak Fix**: Resolved memory leaks in MessagingInterface by implementing proper event listener cleanup
  - **Input Validation**: Added server-side validation for profile updates and CV uploads using Zod schemas
  - **Debug Logging Cleanup**: Removed sensitive authentication information from production logs
  - **Type Safety**: Fixed TypeScript errors in WebSocket authentication and error handling
- **Deployment Configuration Fix**: Resolved NPM dependency conflict between Vite 6.3.5 and @tailwindcss/vite plugin
- **Dependency Cleanup**: Removed conflicting @tailwindcss/vite plugin and standardized on PostCSS-based Tailwind CSS setup
- **Package Optimization**: Updated package-lock.json and resolved esbuild security vulnerabilities
- **Build Verification**: Confirmed production build process works correctly with standard Tailwind/PostCSS configuration
- **Production Ready**: Application now secure, performant, and ready for deployment

### August 13, 2025
- **Catering Job Exclusion**: Fixed external job filtering to exclude catering and hospitality jobs (Head Chef, etc.) that were bypassing event industry filters
- **Enhanced Job Filtering**: Added comprehensive exclusion keywords for non-technical roles like catering, food service, general hospitality, and administrative positions
- **Improved Filter Precision**: Updated filtering algorithm to check exclusion criteria first, then event industry keywords, resulting in higher quality job matches

### August 10, 2025
- **Contract Type Filtering**: Updated Jobs page Category filter from skills-based to contract type filtering (Full-Time, Part-Time, Fixed term, Temporary, Gig)
- **UI Alignment Fix**: Resolved Messages tab notification badge alignment issues in both freelancer and recruiter dashboards
- **Enhanced Filter Logic**: Modified job filtering to use contract_type field instead of job skills categories for better job categorization

### August 9, 2025
- **Event Industry Role Filtering**: Implemented targeted job filtering to limit external job results to specific event industry roles: AV technician, lighting technician, lighting engineer, Camera operator, photographer, video mixer, streaming engineer, Powerpoint technician, Stage manager
- **Enhanced Search Strategy**: Updated external job APIs to use targeted search terms instead of generic "events" keyword, resulting in more relevant job matches
- **Smart Filtering System**: Added comprehensive keyword matching system that filters job titles and descriptions for event industry roles
- **Improved Job Quality**: Now successfully filtering from 40+ raw external jobs down to 6-10 highly relevant event industry positions
- **Technical Role Focus**: Enhanced filtering includes related technical roles like sound engineer, audio engineer, video technician, and production crew positions

### August 8, 2025
- **Critical Profile Bug Resolution**: Fixed major database and UI issue where wrong user profile data was being displayed
- **Database Cleanup**: Removed duplicate recruiter profile records that were causing API to return oldest instead of newest profile data  
- **Profile Display Fix**: Resolved React state timing issue that was showing "create profile" message even when profile data existed
- **User Data Accuracy**: Fixed display of actual registered user name "Alan Stevensdaughter" and company "STARBOKKI" instead of old "Loris Barbisan"/"Event Solutions Ltd" data
- **API Query Enhancement**: Ensured recruiter profile API returns most recent profile record for users with multiple profile entries

### August 6, 2025
- **Job Posting Form Enhancement**: Simplified job posting to start with Job Type dropdown (Contract/Freelance only)
- **Dynamic Form Fields**: Contract jobs show additional Contract Type selection (Full Time/Part Time Contract) and "Salary" field instead of "Rate"
- **Enhanced Job Form Flow**: Progressive disclosure - fields appear based on job type selection, submit buttons only show when required fields are completed
- **CTA Button Visibility Fix**: Fixed "Post Your First Job" button styling with E8 brand colors (#1e90ff) for proper visibility
- **Settings Page Enhancement**: Enhanced Settings page with account holder name display, password status indicator, and password change functionality
- **Password Change System**: Added secure password change popup with form validation (old password, new password, confirm password)
- **Account Information Display**: Settings now shows actual user name from profile data with intelligent fallbacks
- **Enhanced UI**: Added toggle visibility buttons for email and password fields with proper data test IDs

### August 5, 2025
- **User Profile Display Fix**: Fixed account dashboard to display actual user names instead of just email addresses
- **Enhanced Profile Management**: Created useProfile hook to fetch complete user profile data for both freelancers and recruiters
- **Avatar Improvements**: Updated avatar initials to use actual names when available, with intelligent fallbacks
- **Currency Symbol Standardization**: Replaced all dollar signs ($) with unmarked coin symbols (¤) while preserving British pound (£) symbols
- **Icon Updates**: Updated all DollarSign imports to Coins throughout the platform
- **Brand Update**: Updated all Event Link references to E8 branding throughout the application

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
- **Created Jobs Page**: Full job listing page with search, filters, and Event Link design
- **Created Freelancers Page**: Comprehensive crew search page with profiles and skills
- **Updated Routing**: Added /jobs and /freelancers routes to main application
- **Fixed Authentication Flow**: Resolved error messages and redirect issues during login
- **Rate Toggle Feature**: Added hourly/daily rate selector in freelancer dashboard

### January 30, 2025
- **E8 UI Design Complete**: Applied complete E8 branding with blue/purple gradient design
- **Updated Hero Image**: Replaced with corporate event presentation image showing professional AV setup
- **Color Scheme Enhancement**: "Technical" in blue, "Crew" in purple matching E8 brand
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