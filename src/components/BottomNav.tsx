import { Film, Search, Upload, User, Bell } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

let cachedUserId: string | null = null;

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
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

  const fetchUnreadNotifCount = useCallback(async (userId: string) => {
    try {
      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);

      // Also count unread messages
      const { data: convos } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`);

      let msgCount = 0;
      if (convos && convos.length > 0) {
        const { count: mc } = await supabase
          .from('messages')
          .select('*', { count: 'exact', head: true })
          .in('conversation_id', convos.map(c => c.id))
          .eq('is_read', false)
          .neq('sender_id', userId);
        msgCount = mc || 0;
      }

      if (isMounted.current) setUnreadNotifCount((count || 0) + msgCount);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    if (!hasChecked.current) { hasChecked.current = true; checkUser(); }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') { checkUser(); }
      else if (event === 'SIGNED_OUT') { cachedUserId = null; setCurrentUserId(null); setUnreadNotifCount(0); }
    });
    return () => { isMounted.current = false; subscription.unsubscribe(); };
  }, [checkUser]);

  useEffect(() => {
    if (!currentUserId) return;
    fetchUnreadNotifCount(currentUserId);

    const channel = supabase
      .channel('bottom-nav-notifs')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'notifications' }, () => fetchUnreadNotifCount(currentUserId))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => fetchUnreadNotifCount(currentUserId))
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => fetchUnreadNotifCount(currentUserId))
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, fetchUnreadNotifCount]);

  const isActive = (path: string) => {
    if (path === '/profile') return location.pathname.startsWith('/profile');
    return location.pathname === path;
  };

  return (
    <nav className="fixed bottom-3 left-3 right-3 bg-card/95 backdrop-blur-lg border-2 border-primary/40 rounded-3xl shadow-elevated z-50 max-w-lg mx-auto">
      <div className="flex items-end justify-around h-16 px-2 relative">
        <button onClick={() => navigate('/feed')} className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all ${isActive('/feed') ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
          <Film className="h-5 w-5" /><span className="text-[10px] font-semibold">Diskie</span>
        </button>
        <button onClick={() => navigate('/search')} className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all ${isActive('/search') ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
          <Search className="h-5 w-5" /><span className="text-[10px] font-semibold">Explore</span>
        </button>
        <button
          onClick={() => navigate('/upload')}
          aria-label="Upload"
          className="flex items-center justify-center w-12 h-12 -mt-6 rounded-2xl bg-primary text-primary-foreground shadow-lg ring-4 ring-background hover:scale-105 active:scale-95 transition-all"
        >
          <Upload className="h-6 w-6" strokeWidth={2.5} />
        </button>
        <button onClick={() => navigate('/notifications')} className={`relative flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all ${isActive('/notifications') ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
          <div className="relative">
            <Bell className="h-5 w-5" />
            {unreadNotifCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold">Notifications</span>
        </button>
        <button onClick={() => navigate(currentUserId ? `/profile/${currentUserId}` : '/profile')} className={`flex flex-col items-center gap-0.5 px-3 py-2 rounded-2xl transition-all ${isActive('/profile') ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
          <User className="h-5 w-5" /><span className="text-[10px] font-semibold">Profile</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
