import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface PWAUpdateState {
  updateAvailable: boolean;
  checking: boolean;
  clearing: boolean;
  registration: ServiceWorkerRegistration | null;
}

export const usePWAUpdate = () => {
  const [state, setState] = useState<PWAUpdateState>({
    updateAvailable: false,
    checking: false,
    clearing: false,
    registration: null,
  });

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    const handleUpdate = (registration: ServiceWorkerRegistration) => {
      if (registration.waiting) {
        setState(prev => ({ ...prev, updateAvailable: true, registration }));
        toast.info('New version available!', {
          description: 'Tap to update to the latest version.',
          duration: 10000,
          action: {
            label: 'Update Now',
            onClick: () => applyUpdate(registration),
          },
        });
      }
    };

    // Check for existing service worker
    navigator.serviceWorker.ready.then((registration) => {
      setState(prev => ({ ...prev, registration }));
      
      // Check if there's already a waiting worker
      if (registration.waiting) {
        handleUpdate(registration);
      }

      // Listen for new updates
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              handleUpdate(registration);
            }
          });
        }
      });
    });

    // Listen for controller change (new SW activated)
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!refreshing) {
        refreshing = true;
        window.location.reload();
      }
    });
  }, []);

  const applyUpdate = useCallback((reg?: ServiceWorkerRegistration) => {
    const registration = reg || state.registration;
    if (registration?.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      toast.loading('Updating app...');
    }
  }, [state.registration]);

  const checkForUpdates = useCallback(async () => {
    if (!('serviceWorker' in navigator)) {
      toast.error('Service Worker not supported');
      return;
    }

    setState(prev => ({ ...prev, checking: true }));
    
    try {
      const registration = await navigator.serviceWorker.ready;
      await registration.update();
      
      if (registration.waiting) {
        setState(prev => ({ ...prev, updateAvailable: true, checking: false, registration }));
        toast.success('Update available!', {
          description: 'Click "Update Now" to install.',
          action: {
            label: 'Update Now',
            onClick: () => applyUpdate(registration),
          },
        });
      } else {
        setState(prev => ({ ...prev, checking: false }));
        toast.success('You have the latest version!');
      }
    } catch (error) {
      console.error('Update check failed:', error);
      setState(prev => ({ ...prev, checking: false }));
      toast.error('Failed to check for updates');
    }
  }, [applyUpdate]);

  const clearCacheAndReload = useCallback(async () => {
    setState(prev => ({ ...prev, clearing: true }));
    
    try {
      // Clear all caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
        console.log('All caches cleared:', cacheNames);
      }

      // Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(
          registrations.map(registration => registration.unregister())
        );
        console.log('All service workers unregistered');
      }

      // Clear localStorage and sessionStorage
      localStorage.clear();
      sessionStorage.clear();

      toast.success('Cache cleared! Reloading...', { duration: 1500 });
      
      // Force reload from server (bypass cache)
      setTimeout(() => {
        window.location.href = window.location.href.split('?')[0] + '?cacheBust=' + Date.now();
      }, 1500);
      
    } catch (error) {
      console.error('Clear cache failed:', error);
      setState(prev => ({ ...prev, clearing: false }));
      toast.error('Failed to clear cache');
    }
  }, []);

  return {
    updateAvailable: state.updateAvailable,
    checking: state.checking,
    clearing: state.clearing,
    checkForUpdates,
    applyUpdate,
    clearCacheAndReload,
  };
};
