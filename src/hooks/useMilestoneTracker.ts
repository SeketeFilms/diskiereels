import { useState, useCallback, useEffect } from 'react';

export type MilestoneType = 'likes' | 'followers' | 'uploads' | 'views';

interface MilestoneEvent {
  type: MilestoneType;
  value: number;
}

const MILESTONES = {
  likes: [1000, 10000, 50000, 100000, 200000, 500000, 20000000],
  followers: [1000, 10000, 50000, 100000, 200000, 500000, 20000000],
  uploads: [500, 1000, 50000, 1000000],
  views: [1000, 10000, 50000, 100000, 200000, 500000, 20000000],
};

const STORAGE_KEY = 'toonlyreels_achieved_milestones';

const getAchievedMilestones = (): Record<string, number[]> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { likes: [], followers: [], uploads: [], views: [] };
  } catch {
    return { likes: [], followers: [], uploads: [], views: [] };
  }
};

const saveAchievedMilestone = (type: MilestoneType, milestone: number) => {
  const achieved = getAchievedMilestones();
  if (!achieved[type].includes(milestone)) {
    achieved[type].push(milestone);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(achieved));
  }
};

export const useMilestoneTracker = () => {
  const [currentMilestone, setCurrentMilestone] = useState<MilestoneEvent | null>(null);

  const checkMilestone = useCallback((type: MilestoneType, currentValue: number, previousValue?: number) => {
    const milestones = MILESTONES[type];
    const achieved = getAchievedMilestones();
    
    for (const milestone of milestones) {
      // Check if we just crossed this milestone and haven't celebrated it yet
      if (currentValue >= milestone && !achieved[type].includes(milestone)) {
        // If previousValue is provided, only trigger if we just crossed it
        if (previousValue === undefined || previousValue < milestone) {
          saveAchievedMilestone(type, milestone);
          setCurrentMilestone({ type, value: milestone });
          return true;
        }
      }
    }
    return false;
  }, []);

  const clearMilestone = useCallback(() => {
    setCurrentMilestone(null);
  }, []);

  return {
    currentMilestone,
    checkMilestone,
    clearMilestone,
  };
};

// Export for direct usage
export const checkAndTriggerMilestone = (
  type: MilestoneType,
  currentValue: number
): number | null => {
  const milestones = MILESTONES[type];
  const achieved = getAchievedMilestones();
  
  for (const milestone of milestones) {
    if (currentValue >= milestone && !achieved[type].includes(milestone)) {
      saveAchievedMilestone(type, milestone);
      return milestone;
    }
  }
  return null;
};
