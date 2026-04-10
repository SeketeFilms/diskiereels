import { useState, useCallback } from 'react';

const RATING_STORAGE_KEY = 'toonlyreels_rating_data';
const POSITIVE_ACTIONS_THRESHOLD = 5;
const DISMISS_COOLDOWN_DAYS = 7;

interface RatingData {
  hasRated: boolean;
  dismissedAt: string | null;
  positiveActions: number;
}

export const useAppRating = () => {
  const [showRatingPrompt, setShowRatingPrompt] = useState(false);

  const getRatingData = useCallback((): RatingData => {
    try {
      const data = localStorage.getItem(RATING_STORAGE_KEY);
      return data ? JSON.parse(data) : { hasRated: false, dismissedAt: null, positiveActions: 0 };
    } catch {
      return { hasRated: false, dismissedAt: null, positiveActions: 0 };
    }
  }, []);

  const saveRatingData = useCallback((data: RatingData) => {
    localStorage.setItem(RATING_STORAGE_KEY, JSON.stringify(data));
  }, []);

  const trackPositiveAction = useCallback(() => {
    const data = getRatingData();
    
    // Don't track if already rated
    if (data.hasRated) return;
    
    // Check cooldown if dismissed
    if (data.dismissedAt) {
      const dismissedDate = new Date(data.dismissedAt);
      const now = new Date();
      const daysSinceDismiss = (now.getTime() - dismissedDate.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceDismiss < DISMISS_COOLDOWN_DAYS) return;
    }
    
    data.positiveActions += 1;
    saveRatingData(data);
    
    // Show prompt after threshold
    if (data.positiveActions >= POSITIVE_ACTIONS_THRESHOLD) {
      setShowRatingPrompt(true);
    }
  }, [getRatingData, saveRatingData]);

  const handleRateNow = useCallback(() => {
    const data = getRatingData();
    data.hasRated = true;
    data.positiveActions = 0;
    saveRatingData(data);
    setShowRatingPrompt(false);
    
    // Open Play Store
    window.open('https://play.google.com/store/apps/details?id=app.toonlyreels', '_blank');
  }, [getRatingData, saveRatingData]);

  const handleRemindLater = useCallback(() => {
    const data = getRatingData();
    data.dismissedAt = new Date().toISOString();
    data.positiveActions = 0;
    saveRatingData(data);
    setShowRatingPrompt(false);
  }, [getRatingData, saveRatingData]);

  const handleNoThanks = useCallback(() => {
    const data = getRatingData();
    data.hasRated = true; // Treat as "don't ask again"
    saveRatingData(data);
    setShowRatingPrompt(false);
  }, [getRatingData, saveRatingData]);

  return {
    showRatingPrompt,
    trackPositiveAction,
    handleRateNow,
    handleRemindLater,
    handleNoThanks,
    closeRatingPrompt: () => setShowRatingPrompt(false),
  };
};
