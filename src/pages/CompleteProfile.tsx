import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';

const AVATARS = ['🦊', '⚽', '🥅', '🏆', '👟', '🦁', '🐼', '🐯', '🚀', '🌟', '🎨', '🎮'];

const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be less than 30 characters')
  .regex(/^[a-zA-Z0-9_-]+$/, 'Letters, numbers, underscores and hyphens only');

const CompleteProfile = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState('🦊');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth', { replace: true }); return; }
      setUserId(user.id);
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, selected_avatar')
        .eq('id', user.id)
        .maybeSingle();
      if (profile) {
        setUsername(profile.username || '');
        setSelectedAvatar(profile.selected_avatar || '🦊');
      }
      setLoading(false);
    })();
  }, [navigate]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    try {
      usernameSchema.parse(username);
    } catch (err: any) {
      setError(err?.issues?.[0]?.message || 'Invalid username');
      return;
    }
    setSaving(true);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ username, selected_avatar: selectedAvatar })
      .eq('id', userId);
    setSaving(false);
    if (updateError) {
      if (updateError.message.includes('duplicate') || updateError.code === '23505') {
        setError('That username is already taken. Try another.');
      } else {
        setError(updateError.message);
      }
      return;
    }
    toast.success('Profile saved! ⚽');
    navigate('/feed', { replace: true });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-elevated">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-black">Complete your profile</CardTitle>
          <CardDescription>Pick a username and avatar to get started.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSave} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="your_username"
                autoComplete="off"
              />
            </div>
            <div className="space-y-2">
              <Label>Avatar</Label>
              <div className="grid grid-cols-6 gap-2">
                {AVATARS.map((a) => (
                  <button
                    type="button"
                    key={a}
                    onClick={() => setSelectedAvatar(a)}
                    className={`text-2xl h-12 rounded-lg border-2 transition-all ${
                      selectedAvatar === a ? 'border-primary bg-primary/10 scale-110' : 'border-border hover:border-primary/50'
                    }`}
                    aria-label={`avatar ${a}`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save & continue'}
            </Button>
            <Button type="button" variant="ghost" className="w-full" onClick={() => navigate('/feed')}>
              Skip for now
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompleteProfile;
