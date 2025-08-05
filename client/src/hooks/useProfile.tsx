import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { apiRequest } from '@/lib/queryClient';

interface ProfileData {
  first_name?: string;
  last_name?: string;
  company_name?: string;
  contact_name?: string;
}

export const useProfile = () => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) {
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        if (user.role === 'freelancer') {
          const freelancerProfile = await apiRequest(`/api/freelancer/${user.id}`);
          setProfile({
            first_name: freelancerProfile.first_name,
            last_name: freelancerProfile.last_name
          });
        } else if (user.role === 'recruiter') {
          const recruiterProfile = await apiRequest(`/api/recruiter/${user.id}`);
          setProfile({
            company_name: recruiterProfile.company_name,
            contact_name: recruiterProfile.contact_name
          });
        }
      } catch (error) {
        // Profile might not exist yet, that's okay
        setProfile(null);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [user]);

  const getDisplayName = () => {
    if (!user) return '';
    
    if (user.role === 'freelancer' && profile?.first_name && profile?.last_name) {
      return `${profile.first_name} ${profile.last_name}`;
    }
    
    if (user.role === 'recruiter') {
      if (profile?.contact_name) {
        return profile.contact_name;
      }
      if (profile?.company_name) {
        return profile.company_name;
      }
    }
    
    // Fallback to email username, but make it more readable
    const emailName = user.email.split('@')[0];
    // Convert dots/underscores to spaces and capitalize
    return emailName.replace(/[._]/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  };

  const getInitials = () => {
    if (!user) return '';
    
    if (user.role === 'freelancer' && profile?.first_name && profile?.last_name) {
      return `${profile.first_name[0]}${profile.last_name[0]}`.toUpperCase();
    }
    
    if (user.role === 'recruiter') {
      if (profile?.contact_name) {
        const names = profile.contact_name.split(' ');
        return names.length > 1 
          ? `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
          : profile.contact_name.substring(0, 2).toUpperCase();
      }
      if (profile?.company_name) {
        return profile.company_name.substring(0, 2).toUpperCase();
      }
    }
    
    // Better fallback using email name
    const emailName = user.email.split('@')[0];
    const words = emailName.split(/[._]/);
    if (words.length > 1) {
      return `${words[0][0]}${words[1][0]}`.toUpperCase();
    }
    return emailName.substring(0, 2).toUpperCase();
  };

  return {
    profile,
    loading,
    getDisplayName,
    getInitials
  };
};