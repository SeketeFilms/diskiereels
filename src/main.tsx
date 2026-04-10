import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { registerSW } from 'virtual:pwa-register';

// Clear old caches on app start to prevent stale UI
const clearOldCaches = async () => {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    const oldCaches = cacheNames.filter(name => 
      !name.includes('workbox-precache') || 
      name.includes('-precache-v1') // Old cache format
    );
    
    // Clear old runtime caches
    await Promise.all(
      cacheNames
        .filter(name => name.includes('supabase-cache') || name.includes('runtime'))
        .map(name => caches.delete(name))
    );
  }
};

// Run cache cleanup before rendering
clearOldCaches().catch(console.error);

createRoot(document.getElementById("root")!).render(<App />);

// Register the PWA service worker with aggressive updates
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    // Auto-apply updates for a "always latest" experience
    updateSW(true);
  },
  onRegisteredSW(_swUrl, registration) {
    // Clear old caches when SW is registered
    clearOldCaches().catch(console.error);
    
    // Check once on load, then periodically
    registration?.update();
    window.setInterval(() => registration?.update(), 60_000);
  },
});

