import { Film, Search, Upload, User, MessageCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

let cachedUserId: string | null = null;

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const isMounted = useRef(true);
  const hasChecked = useRef(false);

  const checkUser = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!isMounted.current) return;
      if (user) { cachedUserId = user.id; setCurrentUserId(user.id); }
      else { cachedUserId = null; setCurrentUserId(null); }
    } catch { if (isMounted.current) setCurrentUserId(null); }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    if (!hasChecked.current) { hasChecked.current = true; checkUser(); }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') { checkUser(); }
      else if (event === 'SIGNED_OUT') { cachedUserId = null; setCurrentUserId(null); }
    });
    return () => { isMounted.current = false; subscription.unsubscribe(); };
  }, [checkUser]);

  const isActive = (path: string) => {
    if (path === '/profile') return location.pathname.startsWith('/profile');
    return location.pathname === path;
  };

  return (
    <nav className="fixed bottom-4 left-4 right-4 bg-card/95 backdrop-blur-lg border-2 border-border rounded-3xl shadow-2xl z-50 max-w-lg mx-auto">
      <div className="flex items-center justify-around h-16 px-2 relative">
        <button onClick={() => navigate('/feed')} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${isActive('/feed') ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
          <Film className="h-5 w-5" /><span className="text-[10px] font-semibold">Reels</span>
        </button>
        <button onClick={() => navigate('/search')} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${isActive('/search') ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
          <Search className="h-5 w-5" /><span className="text-[10px] font-semibold">Explore</span>
        </button>
        {/* Upload FAB - available to ALL users */}
        <button onClick={() => navigate('/upload')} className="flex items-center justify-center -mt-8 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg hover:scale-110 active:scale-95 transition-all">
          <Upload className="h-6 w-6" />
        </button>
        <button onClick={() => navigate('/messages')} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${isActive('/messages') ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
          <MessageCircle className="h-5 w-5" /><span className="text-[10px] font-semibold">Chat</span>
        </button>
        <button onClick={() => navigate(currentUserId ? `/profile/${currentUserId}` : '/profile')} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${isActive('/profile') ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
          <User className="h-5 w-5" /><span className="text-[10px] font-semibold">Profile</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
