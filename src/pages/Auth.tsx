import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import SaveLoginDialog from '@/components/SaveLoginDialog';

const emailSchema = z.string().email('Please enter a valid email address').max(255, 'Email is too long');
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password is too long');
const usernameSchema = z.string()
  .min(3, 'Username must be at least 3 characters')
  .max(30, 'Username must be less than 30 characters')
  .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores');

const signUpSchema = z.object({ email: emailSchema, password: passwordSchema, username: usernameSchema });
const signInSchema = z.object({ email: emailSchema, password: z.string().min(1, 'Password is required') });

const Auth = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string; username?: string }>({});
  const [showSaveLoginDialog, setShowSaveLoginDialog] = useState(false);
  const [loggedInUser, setLoggedInUser] = useState<{ id: string; email: string; username: string; avatarUrl: string | null; selectedAvatar: string | null } | null>(null);

  useEffect(() => {
    const prefillEmail = searchParams.get('email');
    if (prefillEmail) setEmail(prefillEmail);
  }, [searchParams]);

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) { navigate('/feed', { replace: true }); } else { setCheckingSession(false); }
    };
    checkSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && event === 'SIGNED_IN' && !showSaveLoginDialog && !loggedInUser) {
        navigate('/feed', { replace: true });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, showSaveLoginDialog, loggedInUser]);

  const validateForm = () => {
    setErrors({});
    try {
      if (isSignUp) { signUpSchema.parse({ email, password, username }); }
      else { signInSchema.parse({ email, password }); }
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: typeof errors = {};
        error.issues.forEach((err) => { newErrors[err.path[0] as keyof typeof errors] = err.message; });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const checkIfAccountNeedsSavePrompt = (userId: string) => {
    const savedAccounts = JSON.parse(localStorage.getItem('diskiereels_saved_accounts') || '[]');
    return !savedAccounts.find((acc: any) => acc.id === userId && acc.loginSaved);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    setLoading(true);
    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/feed`,
            data: { username, user_type: 'creative' },
          },
        });
        if (error) throw error;
        if (data.user) {
          toast.success('Account created! Welcome to DiskieReels! ⚽');
          setLoggedInUser({ id: data.user.id, email: data.user.email || email, username, avatarUrl: null, selectedAvatar: null });
          setShowSaveLoginDialog(true);
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        if (data.user) {
          const { data: profile } = await supabase.from('profiles').select('username, avatar_url, selected_avatar').eq('id', data.user.id).single();
          if (checkIfAccountNeedsSavePrompt(data.user.id)) {
            setLoggedInUser({ id: data.user.id, email: data.user.email || email, username: profile?.username || 'User', avatarUrl: profile?.avatar_url || null, selectedAvatar: profile?.selected_avatar || null });
            setShowSaveLoginDialog(true);
          } else {
            toast.success('Welcome back! ⚽');
            navigate('/feed');
          }
        }
      }
    } catch (error: any) {
      if (error.message?.includes('User already registered')) toast.error('This email is already registered. Please sign in.');
      else if (error.message?.includes('Invalid login credentials')) toast.error('Invalid email or password.');
      else toast.error(error.message || 'Authentication failed');
    } finally { setLoading(false); }
  };

  if (checkingSession) {
    return (<div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4 relative">
      <div className="absolute bottom-4 left-4 text-xs text-muted-foreground/50 font-mono">v202604A</div>
      <Card className="w-full max-w-md shadow-elevated animate-in fade-in zoom-in-95 slide-in-from-bottom-4 duration-500">
        <CardHeader className="text-center">
          <div className="mb-4 mx-auto">
            <img src="/diskiereels-logo.png" alt="DiskieReels" className="h-20 w-20 mx-auto" />
          </div>
          <CardTitle className="text-3xl font-black">
            {isSignUp ? 'Join DiskieReels! ⚽' : 'Welcome Back! ⚽'}
          </CardTitle>
          <CardDescription>
            {isSignUp ? 'Create your account to start sharing soccer reels' : 'Sign in to continue'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} onChange={(e) => { setUsername(e.target.value); if (errors.username) setErrors(prev => ({ ...prev, username: undefined })); }} placeholder="Enter username" className={errors.username ? 'border-destructive' : ''} />
                {errors.username && <p className="text-sm text-destructive">{errors.username}</p>}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => { setEmail(e.target.value); if (errors.email) setErrors(prev => ({ ...prev, email: undefined })); }} placeholder="Enter your email" className={errors.email ? 'border-destructive' : ''} />
              {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => { setPassword(e.target.value); if (errors.password) setErrors(prev => ({ ...prev, password: undefined })); }} placeholder="Enter your password" className={errors.password ? 'border-destructive' : ''} />
              {errors.password && <p className="text-sm text-destructive">{errors.password}</p>}
              {isSignUp && !errors.password && <p className="text-xs text-muted-foreground">Must be at least 8 characters</p>}
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Loading...' : isSignUp ? 'Create Account' : 'Sign In'}
            </Button>
          </form>
          <div className="mt-4 text-center space-y-2">
            <button type="button" onClick={() => { setIsSignUp(!isSignUp); setErrors({}); }} className="text-sm text-primary hover:underline font-semibold block w-full">
              {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
            </button>
            <a href="/terms-of-service" className="text-xs text-muted-foreground hover:text-primary hover:underline block">Terms of Use</a>
          </div>
        </CardContent>
      </Card>
      {loggedInUser && (
        <SaveLoginDialog open={showSaveLoginDialog} onOpenChange={setShowSaveLoginDialog} userId={loggedInUser.id} email={loggedInUser.email} username={loggedInUser.username} avatarUrl={loggedInUser.avatarUrl} selectedAvatar={loggedInUser.selectedAvatar} onComplete={() => { toast.success('Welcome! ⚽'); navigate('/feed'); }} />
      )}
    </div>
  );
};

export default Auth;
