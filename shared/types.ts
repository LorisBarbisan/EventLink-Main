// Shared types across the application
export interface User {
  id: number;
  email: string;
  password?: string | null;
  role: 'freelancer' | 'recruiter' | 'admin';
  first_name: string | null;
  last_name: string | null;
  email_verified: boolean;
  email_verification_token?: string | null;
  email_verification_expires?: Date | null;
  password_reset_token?: string | null;
  password_reset_expires?: Date | null;
  auth_provider?: 'email' | 'google' | 'facebook' | 'linkedin';
  google_id?: string | null;
  facebook_id?: string | null;
  linkedin_id?: string | null;
  profile_photo_url?: string | null;
  last_login_method?: 'email' | 'google' | 'facebook' | 'linkedin';
  last_login_at?: Date | null;
  created_at: string | Date;
  updated_at: string | Date;
}

export interface FreelancerProfile {
  id: number;
  user_id: number;
  first_name: string;
  last_name: string;
  title?: string;
  bio?: string;
  location?: string;
  experience_years?: number;
  skills: string[];
  portfolio_url?: string;
  linkedin_url?: string;
  website_url?: string;
  availability_status: 'available' | 'busy' | 'unavailable';
  profile_photo_url?: string;
  cv_file_name?: string;
  cv_file_type?: string;
  cv_file_size?: number;
  cv_file_url?: string;
  created_at: string;
  updated_at: string;
}

export interface RecruiterProfile {
  id: number;
  user_id: number;
  company_name: string;
  contact_name: string;
  company_type: string;
  location: string;
  description: string;
  website_url?: string;
  linkedin_url?: string;
  company_logo_url?: string;
  created_at: string;
  updated_at: string;
}

export interface Job {
  id: number;
  recruiter_id: number;
  title: string;
  company: string;
  location: string;
  type: string;
  rate: string;
  description: string;
  status: 'active' | 'paused' | 'closed';
  external_id?: string;
  external_source?: string;
  external_url?: string;
  posted_date?: string;
  created_at: string;
  updated_at: string;
}

export interface JobApplication {
  id: number;
  job_id: number;
  freelancer_id: number;
  status: 'applied' | 'pending' | 'reviewed' | 'rejected' | 'hired';
  cover_letter?: string;
  rejection_message?: string;
  applied_at: string;
  updated_at: string;
  freelancer_profile?: FreelancerProfile;
  job_title?: string;
  job_company?: string;
}

export interface Message {
  id: number;
  sender_id: number;
  receiver_id: number;
  content: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

export interface NotificationState {
  lastViewedApplications: number;
  lastViewedJobs: number;
  lastViewedMessages: number;
}

// Form state interfaces
export interface FreelancerFormData {
  first_name: string;
  last_name: string;
  title: string;
  bio: string;
  location: string;
  experience_years: string;
  skills: string[];
  portfolio_url: string;
  linkedin_url: string;
  website_url: string;
  availability_status: 'available' | 'busy' | 'unavailable';
  profile_photo_url: string;
}

export interface RecruiterFormData {
  company_name: string;
  contact_name: string;
  company_type: string;
  location: string;
  description: string;
  website_url: string;
  linkedin_url: string;
  company_logo_url: string;
}

export interface JobFormData {
  title: string;
  type: string;
  contract_type?: string;
  location: string;
  rate: string;
  description: string;
  event_date: string;
  // Job duration fields
  duration_type: 'time' | 'days' | 'hours' | '';
  start_time: string;
  end_time: string;
  days: string;
  hours: string;
}