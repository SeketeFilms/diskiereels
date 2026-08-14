import { useEffect, useState } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  initOneSignal,
  getPushPermission,
  requestPushPermission,
  loginOneSignal,
  logoutOneSignal,
} from '@/lib/onesignal';

const DISMISS_KEY = 'diskie_push_prompt_dismissed';

/**
 * Requests notification opt-in before registering the device with OneSignal.
 * Once granted, the signed-in user id is used as the OneSignal external id so
 * the backend can target them in sendPush.
 */
const PushPermissionPrompt = () => {
  const [visible, setVisible] = useState(false);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const sync = async (uid: string | null) => {
      if (!active) return;
      setUserId(uid);
      if (!uid) {
        setVisible(false);
        void logoutOneSignal();
        return;
      }

      await initOneSignal();
      const permission = await getPushPermission();
      if (!active) return;

      if (permission === 'granted') {
        void loginOneSignal(uid);
        setVisible(false);
      } else if (permission === 'default' && !localStorage.getItem(DISMISS_KEY)) {
        setVisible(true);
      }
    };

    supabase.auth.getSession().then(({ data }) => sync(data.session?.user?.id ?? null));

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => sync(session?.user?.id ?? null), 0);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const enable = async () => {
    setBusy(true);
    const granted = await requestPushPermission();
    if (granted && userId) await loginOneSignal(userId);
    setBusy(false);
    setVisible(false);
    if (!granted) localStorage.setItem(DISMISS_KEY, '1');
  };

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed inset-x-3 bottom-24 z-[70] md:left-auto md:right-6 md:w-80">
      <div className="relative rounded-2xl border border-border bg-card p-4 shadow-xl">
        <button
          onClick={dismiss}
          aria-label="Dismiss notification prompt"
          className="absolute right-2 top-2 rounded-full p-1 text-muted-foreground hover:bg-muted"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary">
            <Bell className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">Turn on notifications</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Get alerts when someone follows you, likes or comments on your reels.
            </p>
            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={enable} disabled={busy}>
                {busy ? 'Enabling…' : 'Enable'}
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PushPermissionPrompt;
