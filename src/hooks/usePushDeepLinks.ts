import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { onPushOpened } from '@/lib/onesignal';
import { buildPushDeepLink } from '@/lib/pushDeepLink';

/** Navigates to the exact content that triggered a push when the user taps it. */
export const usePushDeepLinks = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    onPushOpened((data) => {
      if (cancelled) return;
      const path = buildPushDeepLink(data);
      navigate(path);
    });

    return () => {
      cancelled = true;
    };
  }, [navigate]);
};
