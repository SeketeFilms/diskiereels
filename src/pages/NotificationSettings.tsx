import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Bell, BellOff, Loader2, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ResponsiveLayout from '@/components/ResponsiveLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import {
  getPushPermission,
  initOneSignal,
  loginOneSignal,
  requestPushPermission,
} from '@/lib/onesignal';

interface Prefs {
  push_enabled: boolean;
  sound_enabled: boolean;
  likes_enabled: boolean;
  comments_enabled: boolean;
  follows_enabled: boolean;
  replies_enabled: boolean;
  new_videos_enabled: boolean;
}

interface Template {
  id: string;
  event_type: string;
  title_template: string;
  body_template: string;
  enabled: boolean;
}

const TOPICS: { key: keyof Prefs; label: string; description: string }[] = [
  { key: 'follows_enabled', label: 'New followers', description: 'When someone follows you' },
  { key: 'likes_enabled', label: 'Likes', description: 'When someone likes your reel' },
  { key: 'comments_enabled', label: 'Comments', description: 'When someone comments on your reel' },
  { key: 'replies_enabled', label: 'Replies', description: 'When someone replies to your comment' },
  { key: 'new_videos_enabled', label: 'New reels', description: 'When a creator you follow posts' },
];

const DEFAULT_PREFS: Prefs = {
  push_enabled: false,
  sound_enabled: true,
  likes_enabled: true,
  comments_enabled: true,
  follows_enabled: true,
  replies_enabled: true,
  new_videos_enabled: true,
};

const NotificationSettings = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [permission, setPermission] = useState<'granted' | 'denied' | 'default'>('default');
  const [isAdmin, setIsAdmin] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }
      setUserId(user.id);

      const [{ data: prefRow }, { data: roles }, { data: tpls }] = await Promise.all([
        supabase.from('notification_preferences').select('*').eq('user_id', user.id).maybeSingle(),
        supabase.from('user_roles').select('role').eq('user_id', user.id),
        supabase.from('push_templates').select('*').order('event_type'),
      ]);

      if (prefRow) {
        setPrefs({
          push_enabled: prefRow.push_enabled ?? false,
          sound_enabled: prefRow.sound_enabled ?? true,
          likes_enabled: prefRow.likes_enabled ?? true,
          comments_enabled: prefRow.comments_enabled ?? true,
          follows_enabled: prefRow.follows_enabled ?? true,
          replies_enabled: prefRow.replies_enabled ?? true,
          new_videos_enabled: (prefRow as any).new_videos_enabled ?? true,
        });
      }
      setIsAdmin(!!roles?.some((r) => r.role === 'admin'));
      setTemplates((tpls as Template[]) ?? []);

      await initOneSignal();
      setPermission(await getPushPermission());
      setLoading(false);
    };
    load();
  }, [navigate]);

  const persist = async (next: Prefs) => {
    if (!userId) return;
    setPrefs(next);
    setSaving(true);
    const { error } = await supabase
      .from('notification_preferences')
      .upsert({ user_id: userId, ...next }, { onConflict: 'user_id' });
    setSaving(false);
    if (error) toast.error('Could not save notification settings');
  };

  const togglePush = async (value: boolean) => {
    if (value && permission !== 'granted') {
      const granted = await requestPushPermission();
      setPermission(granted ? 'granted' : 'denied');
      if (!granted) {
        toast.error('Notification permission was not granted');
        return;
      }
      if (userId) await loginOneSignal(userId);
    }
    await persist({ ...prefs, push_enabled: value });
    toast.success(value ? 'Push notifications enabled' : 'Push notifications turned off');
  };

  const saveTemplate = async (tpl: Template) => {
    setSavingTemplate(tpl.id);
    const { error } = await supabase
      .from('push_templates')
      .update({
        title_template: tpl.title_template,
        body_template: tpl.body_template,
        enabled: tpl.enabled,
      })
      .eq('id', tpl.id);
    setSavingTemplate(null);
    if (error) toast.error('Only admins can edit templates');
    else toast.success(`${tpl.event_type} template saved`);
  };

  const updateTemplate = (id: string, patch: Partial<Template>) =>
    setTemplates((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  return (
    <ResponsiveLayout>
      <div className="mx-auto w-full max-w-2xl px-4 pb-28 pt-4">
        <header className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/settings')} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold">Notifications</h1>
          {saving && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </header>

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-full bg-primary/10 p-2 text-primary">
                    {prefs.push_enabled ? <Bell className="h-5 w-5" /> : <BellOff className="h-5 w-5" />}
                  </div>
                  <div>
                    <p className="font-semibold">Push notifications</p>
                    <p className="text-xs text-muted-foreground">
                      Get alerts on this device even when the app is closed.
                    </p>
                    <Badge variant="secondary" className="mt-2 text-[10px]">
                      Permission: {permission}
                    </Badge>
                  </div>
                </div>
                <Switch checked={prefs.push_enabled} onCheckedChange={togglePush} />
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="mb-1 font-semibold">Topics</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Choose which activity sends you a notification.
              </p>
              <div className="space-y-3">
                {TOPICS.map((topic) => (
                  <div key={topic.key} className="flex items-center justify-between gap-4">
                    <div>
                      <Label className="text-sm">{topic.label}</Label>
                      <p className="text-xs text-muted-foreground">{topic.description}</p>
                    </div>
                    <Switch
                      checked={prefs[topic.key] as boolean}
                      onCheckedChange={(v) => persist({ ...prefs, [topic.key]: v })}
                    />
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 border-t border-border pt-3">
                  <div>
                    <Label className="text-sm">In-app sound</Label>
                    <p className="text-xs text-muted-foreground">Play a chime for new activity</p>
                  </div>
                  <Switch
                    checked={prefs.sound_enabled}
                    onCheckedChange={(v) => persist({ ...prefs, sound_enabled: v })}
                  />
                </div>
              </div>
            </Card>

            <Card className="p-4">
              <h2 className="mb-1 font-semibold">Message templates</h2>
              <p className="mb-3 text-xs text-muted-foreground">
                {isAdmin
                  ? 'Use {actor} to insert the name of the person who triggered the notification.'
                  : 'These are the messages sent for each event. Only admins can edit them.'}
              </p>
              <div className="space-y-4">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="rounded-lg border border-border p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <Badge variant="outline" className="capitalize">
                        {tpl.event_type.replace('_', ' ')}
                      </Badge>
                      <Switch
                        checked={tpl.enabled}
                        disabled={!isAdmin}
                        onCheckedChange={(v) => updateTemplate(tpl.id, { enabled: v })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Input
                        value={tpl.title_template}
                        disabled={!isAdmin}
                        placeholder="Title"
                        onChange={(e) => updateTemplate(tpl.id, { title_template: e.target.value })}
                      />
                      <Input
                        value={tpl.body_template}
                        disabled={!isAdmin}
                        placeholder="Message"
                        onChange={(e) => updateTemplate(tpl.id, { body_template: e.target.value })}
                      />
                    </div>
                    {isAdmin && (
                      <Button
                        size="sm"
                        className="mt-2"
                        disabled={savingTemplate === tpl.id}
                        onClick={() => saveTemplate(tpl)}
                      >
                        <Save className="mr-1 h-4 w-4" />
                        {savingTemplate === tpl.id ? 'Saving…' : 'Save'}
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </Card>

            <p className="px-1 text-xs text-muted-foreground">
              We never send the same alert twice within 5 minutes, and cap pushes at 12 per 10 minutes
              so your device stays quiet.
            </p>
          </div>
        )}
      </div>
    </ResponsiveLayout>
  );
};

export default NotificationSettings;
