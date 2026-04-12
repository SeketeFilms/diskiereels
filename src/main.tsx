import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

import { registerSW } from 'virtual:pwa-register';

// Guard: never register SW in iframes or preview hosts
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  window.location.hostname.includes("id-preview--") ||
  window.location.hostname.includes("lovableproject.com");

if (isPreviewHost || isInIframe) {
  navigator.serviceWorker?.getRegistrations().then((regs) => {
    regs.forEach((r) => r.unregister());
  });
}

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
if (!isPreviewHost && !isInIframe) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
    onRegisteredSW(_swUrl, registration) {
      clearOldCaches().catch(console.error);
      registration?.update();
      window.setInterval(() => registration?.update(), 60_000);
    },
  });
}

