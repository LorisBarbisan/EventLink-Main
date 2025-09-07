import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';

interface FeedbackPromptState {
  showPrompt: boolean;
  shouldShowPrompt: () => boolean;
  dismissPrompt: () => void;
}

export function useFeedbackPrompt(): FeedbackPromptState {
  const [showPrompt, setShowPrompt] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    // Check if popup should be shown on location change
    const checkPromptConditions = () => {
      // Don't show if already submitted feedback or dismissed in this session
      if (sessionStorage.getItem('feedback_submitted') === 'true' || 
          sessionStorage.getItem('feedback_popup_dismissed') === 'true') {
        return;
      }

      // Initialize session data if not exists
      const sessionStart = sessionStorage.getItem('session_start');
      if (!sessionStart) {
        sessionStorage.setItem('session_start', Date.now().toString());
        sessionStorage.setItem('pages_visited', '1');
        sessionStorage.setItem('visited_pages', JSON.stringify([location]));
        return;
      }

      // Update page visit tracking
      const pagesVisited = parseInt(sessionStorage.getItem('pages_visited') || '1');
      const visitedPages = JSON.parse(sessionStorage.getItem('visited_pages') || '[]');
      
      // Only count if it's a new unique page
      if (!visitedPages.includes(location)) {
        const newPagesVisited = pagesVisited + 1;
        const newVisitedPages = [...visitedPages, location];
        
        sessionStorage.setItem('pages_visited', newPagesVisited.toString());
        sessionStorage.setItem('visited_pages', JSON.stringify(newVisitedPages));

        // Check if conditions are met
        const timeSpent = Date.now() - parseInt(sessionStart);
        const threeMinutes = 3 * 60 * 1000; // 3 minutes in milliseconds

        if (timeSpent >= threeMinutes && newPagesVisited >= 3) {
          setShowPrompt(true);
        }
      }
    };

    // Add a small delay to ensure page has loaded
    const timer = setTimeout(checkPromptConditions, 1000);
    return () => clearTimeout(timer);
  }, [location]);

  const shouldShowPrompt = () => {
    const sessionStart = sessionStorage.getItem('session_start');
    if (!sessionStart) return false;

    const timeSpent = Date.now() - parseInt(sessionStart);
    const pagesVisited = parseInt(sessionStorage.getItem('pages_visited') || '0');
    const threeMinutes = 3 * 60 * 1000;

    return timeSpent >= threeMinutes && 
           pagesVisited >= 3 && 
           !sessionStorage.getItem('feedback_submitted') &&
           !sessionStorage.getItem('feedback_popup_dismissed');
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
    sessionStorage.setItem('feedback_popup_dismissed', 'true');
  };

  return {
    showPrompt,
    shouldShowPrompt,
    dismissPrompt,
  };
}