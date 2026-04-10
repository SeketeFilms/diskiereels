import { useState, useEffect } from 'react';

const APP_VERSION = '202601C';
const VERSION_STORAGE_KEY = 'toonlyreels_last_seen_version';

export interface ChangelogEntry {
  version: string;
  date: string;
  changes: string[];
}

export const changelog: ChangelogEntry[] = [
  {
    version: '202601C',
    date: 'January 2, 2026',
    changes: [
      '🎬 Added fullscreen mode for PC and tablets',
      '⭐ New in-app rating prompt to share your feedback',
      '📋 Added this changelog to keep you updated',
      '🔧 Improved cache management for faster updates',
      '💫 Enhanced video player performance',
    ],
  },
  {
    version: '202601B',
    date: 'January 1, 2026',
    changes: [
      '🚀 Initial PWA release with native-like experience',
      '📱 Capacitor setup for Android app',
      '🔄 Force update feature for stuck caches',
      '🎥 Video playback improvements',
    ],
  },
];

export const useChangelog = () => {
  const [showChangelog, setShowChangelog] = useState(false);
  const [isNewVersion, setIsNewVersion] = useState(false);

  useEffect(() => {
    const lastSeenVersion = localStorage.getItem(VERSION_STORAGE_KEY);
    
    if (lastSeenVersion !== APP_VERSION) {
      // Show changelog for new users or updated users
      if (lastSeenVersion) {
        setIsNewVersion(true);
        setShowChangelog(true);
      }
    }
  }, []);

  const markAsSeen = () => {
    localStorage.setItem(VERSION_STORAGE_KEY, APP_VERSION);
    setShowChangelog(false);
  };

  const openChangelog = () => {
    setShowChangelog(true);
  };

  return {
    showChangelog,
    isNewVersion,
    currentVersion: APP_VERSION,
    changelog,
    markAsSeen,
    openChangelog,
    closeChangelog: () => setShowChangelog(false),
  };
};
