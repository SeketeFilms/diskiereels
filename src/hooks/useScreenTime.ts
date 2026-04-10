import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useScreenTime = (userId: string | null) => {
  const [isLocked, setIsLocked] = useState(false);
  const [timeUsed, setTimeUsed] = useState(0);
  const [timeLimit, setTimeLimit] = useState(60);
  const [lockReason, setLockReason] = useState<'screen_time' | 'bedtime' | 'school_hours' | null>(null);
  const [controls, setControls] = useState<any | null>(null);
  const [controlsLoaded, setControlsLoaded] = useState(false);

  const getUsageKey = useCallback(() => {
    if (!userId) return null;
    const today = new Date().toDateString();
    return `screen_time_${userId}_${today}`;
  }, [userId]);

  const fetchControls = useCallback(async () => {
    if (!userId) return;

    try {
      const { data, error } = await supabase
        .from('parental_controls')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) throw error;
      setControls(data ?? null);
    } catch (error) {
      console.error('Error fetching parental controls:', error);
      setControls(null);
    } finally {
      setControlsLoaded(true);
    }
  }, [userId]);

  const lockCheckIntervalMs = useMemo(() => {
    // If nothing is enabled, avoid minute-by-minute network + CPU churn.
    if (!controls) return 10 * 60_000;
    const anyTimeBasedLockEnabled = Boolean(controls?.bedtime_lock || controls?.school_hours_lock);
    const screenTimeEnabled = controls?.screen_time_enabled === true;
    return anyTimeBasedLockEnabled || screenTimeEnabled ? 60_000 : 10 * 60_000;
  }, [controls]);

  const checkLockStatus = useCallback(async () => {
    if (!userId) return;

    // Ensure we have controls loaded at least once.
    if (!controlsLoaded) {
      await fetchControls();
      return;
    }

    try {
      if (!controls) {
        setIsLocked(false);
        setLockReason(null);
        return;
      }

      const now = new Date();
      const currentTime = now.getHours() * 60 + now.getMinutes();

      // Check bedtime lock
      if (controls.bedtime_lock && controls.bedtime_start && controls.bedtime_end) {
        const [bedStartH, bedStartM] = controls.bedtime_start.split(':').map(Number);
        const [bedEndH, bedEndM] = controls.bedtime_end.split(':').map(Number);
        const bedStart = bedStartH * 60 + bedStartM;
        const bedEnd = bedEndH * 60 + bedEndM;

        if (bedStart > bedEnd) {
          if (currentTime >= bedStart || currentTime < bedEnd) {
            setIsLocked(true);
            setLockReason('bedtime');
            return;
          }
        } else if (currentTime >= bedStart && currentTime < bedEnd) {
          setIsLocked(true);
          setLockReason('bedtime');
          return;
        }
      }

      // Check school hours lock (weekdays only)
      if (controls.school_hours_lock && controls.school_start_time && controls.school_end_time) {
        const dayOfWeek = now.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          const [schoolStartH, schoolStartM] = controls.school_start_time.split(':').map(Number);
          const [schoolEndH, schoolEndM] = controls.school_end_time.split(':').map(Number);
          const schoolStart = schoolStartH * 60 + schoolStartM;
          const schoolEnd = schoolEndH * 60 + schoolEndM;

          if (currentTime >= schoolStart && currentTime < schoolEnd) {
            setIsLocked(true);
            setLockReason('school_hours');
            return;
          }
        }
      }

      // Check screen time limit (only if explicitly enabled)
      if (controls.screen_time_enabled === true && controls.screen_time_limit) {
        setTimeLimit(controls.screen_time_limit);
        
        const usageKey = getUsageKey();
        if (usageKey) {
          const storedUsage = parseInt(localStorage.getItem(usageKey) || '0', 10);
          setTimeUsed(storedUsage);
          
          if (storedUsage >= controls.screen_time_limit) {
            setIsLocked(true);
            setLockReason('screen_time');
            return;
          }
        }
      }

      setIsLocked(false);
      setLockReason(null);
    } catch (error) {
      console.error('Error checking lock status:', error);
    }
  }, [userId, controls, controlsLoaded, fetchControls, getUsageKey]);

  // Track time spent
  const trackTime = useCallback(() => {
    const usageKey = getUsageKey();
    if (!usageKey || isLocked) return;

    const currentUsage = parseInt(localStorage.getItem(usageKey) || '0', 10);
    const newUsage = currentUsage + 1;
    localStorage.setItem(usageKey, newUsage.toString());
    setTimeUsed(newUsage);

    if (newUsage >= timeLimit) {
      setIsLocked(true);
      setLockReason('screen_time');
    }
  }, [getUsageKey, isLocked, timeLimit]);

  const unlock = useCallback(() => {
    setIsLocked(false);
    setLockReason(null);
    checkLockStatus();
  }, [checkLockStatus]);

  // Load controls on mount and refresh periodically (lightweight).
  useEffect(() => {
    if (!userId) return;

    fetchControls();

    const refreshInterval = window.setInterval(fetchControls, 10 * 60_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') fetchControls();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      window.clearInterval(refreshInterval);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [userId, fetchControls]);

  // Check lock status on a schedule WITHOUT hitting the network every minute.
  useEffect(() => {
    if (!userId) return;
    if (!controlsLoaded) return;

    checkLockStatus();
    const lockCheckInterval = window.setInterval(checkLockStatus, lockCheckIntervalMs);
    return () => window.clearInterval(lockCheckInterval);
  }, [userId, controlsLoaded, checkLockStatus, lockCheckIntervalMs]);

  // Track time every minute when active
  useEffect(() => {
    if (!userId || isLocked) return;

    const timeTrackInterval = setInterval(trackTime, 60000);
    
    return () => clearInterval(timeTrackInterval);
  }, [userId, isLocked, trackTime]);

  return {
    isLocked,
    lockReason,
    timeUsed,
    timeLimit,
    unlock,
    checkLockStatus,
  };
};
