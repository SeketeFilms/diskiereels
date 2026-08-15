import { Capacitor } from '@capacitor/core';
import { supabase } from '@/integrations/supabase/client';

export const ONESIGNAL_APP_ID = '1f015029-2aa3-41db-894d-9aa14c50b11d';

let initPromise: Promise<boolean> | null = null;
let nativePlugin: any = null;
let webSdk: any = null;

export const isNativePush = () => Capacitor.isNativePlatform();

/** Initialise the OneSignal SDK once (native plugin on device, web SDK in browser). */
export const initOneSignal = async (): Promise<boolean> => {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      if (isNativePush()) {
        const mod = await import('onesignal-cordova-plugin');
        nativePlugin = (mod as any).default ?? mod;
        nativePlugin.initialize(ONESIGNAL_APP_ID);
        return true;
      }

      if (typeof window === 'undefined' || !('Notification' in window)) return false;
      const mod = await import('react-onesignal');
      webSdk = (mod as any).default ?? mod;
      await webSdk.init({
        appId: ONESIGNAL_APP_ID,
        allowLocalhostAsSecureOrigin: true,
        serviceWorkerParam: { scope: '/onesignal/' },
        serviceWorkerPath: 'OneSignalSDKWorker.js',
      });
      return true;
    } catch (err) {
      console.warn('[OneSignal] init skipped:', err);
      return false;
    }
  })();

  return initPromise;
};

/** Current OS-level permission state, normalised across platforms. */
export const getPushPermission = async (): Promise<'granted' | 'denied' | 'default'> => {
  try {
    if (isNativePush()) {
      if (!nativePlugin) return 'default';
      const granted = await nativePlugin.Notifications.getPermissionAsync();
      return granted ? 'granted' : 'default';
    }
    if (typeof Notification === 'undefined') return 'denied';
    return Notification.permission as 'granted' | 'denied' | 'default';
  } catch {
    return 'default';
  }
};

/** Ask the user to opt in. Returns true when permission is granted. */
export const requestPushPermission = async (): Promise<boolean> => {
  const ready = await initOneSignal();
  if (!ready) return false;

  try {
    if (isNativePush()) {
      return await nativePlugin.Notifications.requestPermission(true);
    }
    await webSdk.Notifications.requestPermission();
    return Notification.permission === 'granted';
  } catch (err) {
    console.warn('[OneSignal] permission request failed:', err);
    return false;
  }
};

/** Link the signed-in user to OneSignal and persist the external id on their profile. */
export const loginOneSignal = async (userId: string) => {
  const ready = await initOneSignal();
  if (!ready || !userId) return;

  try {
    if (isNativePush()) {
      nativePlugin.login(userId);
    } else {
      await webSdk.login(userId);
    }
  } catch (err) {
    console.warn('[OneSignal] login failed:', err);
    return;
  }

  try {
    await supabase
      .from('profiles')
      .update({ onesignal_external_id: userId } as any)
      .eq('id', userId);
  } catch (err) {
    console.warn('[OneSignal] failed to store external id:', err);
  }
};

/** Unlink the device on sign-out. */
export const logoutOneSignal = async () => {
  try {
    if (isNativePush()) nativePlugin?.logout();
    else await webSdk?.logout();
  } catch {
    /* noop */
  }
};

type PushOpenedHandler = (data: Record<string, any>) => void;

/** Registers a handler that fires when the user taps a push notification. */
export const onPushOpened = async (handler: PushOpenedHandler) => {
  const ready = await initOneSignal();
  if (!ready) return;

  try {
    if (isNativePush()) {
      nativePlugin?.Notifications?.addEventListener('click', (event: any) => {
        handler(event?.notification?.additionalData ?? {});
      });
    } else {
      webSdk?.Notifications?.addEventListener('click', (event: any) => {
        handler(event?.notification?.additionalData ?? {});
      });
    }
  } catch (err) {
    console.warn('[OneSignal] click listener failed:', err);
  }
};
