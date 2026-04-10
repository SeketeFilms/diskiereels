// Haptic feedback hook for mobile interactions
export const useHapticFeedback = () => {
  const triggerHaptic = (type: 'light' | 'medium' | 'heavy' = 'medium') => {
    // Check if vibration API is available
    if ('vibrate' in navigator) {
      const duration = type === 'light' ? 10 : type === 'medium' ? 25 : 50;
      navigator.vibrate(duration);
    }
  };

  const triggerLikeHaptic = () => {
    // Double vibration pattern for likes
    if ('vibrate' in navigator) {
      navigator.vibrate([15, 50, 15]);
    }
  };

  const triggerScrollHaptic = () => {
    // Light haptic for scroll snap
    if ('vibrate' in navigator) {
      navigator.vibrate(8);
    }
  };

  return { triggerHaptic, triggerLikeHaptic, triggerScrollHaptic };
};
