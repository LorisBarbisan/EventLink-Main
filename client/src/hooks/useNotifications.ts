import { useState, useEffect } from 'react';

interface UseNotificationsProps {
  userId: number;
  userType: 'freelancer' | 'recruiter';
}

interface NotificationCounts {
  applications?: number;
  jobs?: number;
  messages?: number;
}

export function useNotifications({ userId, userType }: UseNotificationsProps) {
  const [lastViewed, setLastViewed] = useState(() => {
    const applications = localStorage.getItem(`${userType}LastViewedApplications`);
    const jobs = localStorage.getItem(`${userType}LastViewedJobs`);
    const messages = localStorage.getItem(`${userType}LastViewedMessages`);
    
    return {
      applications: applications ? parseInt(applications) : Date.now(),
      jobs: jobs ? parseInt(jobs) : Date.now(),
      messages: messages ? parseInt(messages) : Date.now(),
    };
  });

  const markAsViewed = (type: 'applications' | 'jobs' | 'messages') => {
    const now = Date.now();
    setLastViewed(prev => ({ ...prev, [type]: now }));
    localStorage.setItem(`${userType}LastViewed${type.charAt(0).toUpperCase() + type.slice(1)}`, now.toString());
  };

  const hasNewNotifications = (data: any[], lastViewedTime: number, timestampField = 'updated_at') => {
    if (!data || data.length === 0) return false;
    return data.some(item => new Date(item[timestampField]).getTime() > lastViewedTime);
  };

  return {
    lastViewed,
    markAsViewed,
    hasNewNotifications,
  };
}