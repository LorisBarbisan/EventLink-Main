import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import type { FreelancerProfile, RecruiterProfile, FreelancerFormData, RecruiterFormData } from '@shared/types';

interface UseProfileProps {
  userId: number;
  userType: 'freelancer' | 'recruiter';
}

export function useProfile({ userId, userType }: UseProfileProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch profile - only when userId is valid
  const { data: profile, isLoading } = useQuery({
    queryKey: [`/api/${userType}`, userId],
    queryFn: () => apiRequest(`/api/${userType}/${userId}`),
    enabled: userId > 0, // Only fetch when we have a valid user ID
    retry: false,
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (profileData: FreelancerFormData | RecruiterFormData) => {
      console.log('useProfile updateMutation - sending data to API:', profileData);
      if (userType === 'recruiter') {
        console.log('Recruiter data company_logo_url length:', (profileData as RecruiterFormData).company_logo_url?.length);
      }
      return await apiRequest(`/api/${userType}/${userId}`, {
        method: 'PUT',
        body: JSON.stringify(profileData),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/${userType}`, userId] });
      toast({
        title: 'Profile updated',
        description: 'Your profile has been updated successfully.',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to update profile.',
        variant: 'destructive',
      });
    },
  });

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (profileData: FreelancerFormData | RecruiterFormData) => {
      console.log('useProfile createMutation - sending data to API:', profileData);
      if (userType === 'recruiter') {
        console.log('Recruiter create data company_logo_url length:', (profileData as RecruiterFormData).company_logo_url?.length);
      }
      return await apiRequest(`/api/${userType}`, {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, ...profileData }),
        headers: { 'Content-Type': 'application/json' },
      });
    },
    onSuccess: (newProfile) => {
      // Invalidate and refetch to get the newly created profile
      queryClient.invalidateQueries({ queryKey: [`/api/${userType}`, userId] });
      queryClient.refetchQueries({ queryKey: [`/api/${userType}`, userId] });
      toast({
        title: 'Profile created',
        description: 'Your profile has been created successfully.',
      });
    },
    onError: (error) => {
      console.error('Profile creation error:', error);
      toast({
        title: 'Error',
        description: 'Failed to create profile. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const saveProfile = (data: FreelancerFormData | RecruiterFormData) => {
    if (profile) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return {
    profile: profile as FreelancerProfile | RecruiterProfile | undefined,
    isLoading,
    saveProfile,
    isSaving: updateMutation.isPending || createMutation.isPending,
  };
}