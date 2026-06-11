// --- TYPES ---
export interface User {
  id: number;
  email: string;
  role: "freelancer" | "recruiter" | "admin";
  deleted_at?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  company_name?: string | null;
  profile_photo_url?: string | null;
  title?: string | null; // freelancer professional headline
}

export interface Message {
  id: number;
  conversation_id: number;
  sender_id: number | null;
  content: string;
  is_read: boolean;
  is_system_message: boolean;
  created_at: string;
  sender: User;
  __optimistic?: boolean;
}

export interface Conversation {
  id: number;
  participant_one_id: number;
  participant_two_id: number;
  last_message_at: string;
  created_at: string;
  otherUser: User;
  last_message_preview?: string | null;
  unread_count?: number;
}

export const isUserDeleted = (user: User | undefined) => !!user?.deleted_at;

export const getDisplayName = (user: User) => {
  if (isUserDeleted(user))
    return `[Deleted ${user.role === "freelancer" ? "Freelancer" : "Company"}]`;
  if (user.first_name && user.last_name) return `${user.first_name} ${user.last_name}`;
  if (user.company_name) return user.company_name;
  return user.email;
};

export const getAvatarInitials = (user: User) => {
  if (isUserDeleted(user)) return user.role === "freelancer" ? "DF" : "DC";
  if (user.first_name && user.last_name)
    return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
  if (user.company_name) return user.company_name.substring(0, 2).toUpperCase();
  return user.email.substring(0, 2).toUpperCase();
};

export const getUserHeadline = (user: User): string => {
  if (isUserDeleted(user)) return "";
  if (user.title) return user.title;
  if (user.role === "recruiter") return "Employer";
  if (user.role === "freelancer") return "Freelancer";
  return "";
};
