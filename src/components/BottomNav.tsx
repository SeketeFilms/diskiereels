import { Film, Search, Upload, User, MessageCircle } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

let cachedUserId: string | null = null;

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
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

  // Fetch unread message count
  const fetchUnreadCount = useCallback(async (userId: string) => {
    try {
      // Get conversations for this user
      const { data: convos } = await supabase
        .from('conversations')
        .select('id')
        .or(`participant_one.eq.${userId},participant_two.eq.${userId}`);
      
      if (!convos || convos.length === 0) { setUnreadCount(0); return; }

      const convoIds = convos.map(c => c.id);
      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .in('conversation_id', convoIds)
        .eq('is_read', false)
        .neq('sender_id', userId);

      if (isMounted.current) setUnreadCount(count || 0);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    if (!hasChecked.current) { hasChecked.current = true; checkUser(); }
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') { checkUser(); }
      else if (event === 'SIGNED_OUT') { cachedUserId = null; setCurrentUserId(null); setUnreadCount(0); }
    });
    return () => { isMounted.current = false; subscription.unsubscribe(); };
  }, [checkUser]);

  // Fetch unread count when userId changes + subscribe to realtime
  useEffect(() => {
    if (!currentUserId) return;
    fetchUnreadCount(currentUserId);

    const channel = supabase
      .channel('bottom-nav-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        fetchUnreadCount(currentUserId);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
        fetchUnreadCount(currentUserId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [currentUserId, fetchUnreadCount]);

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
        <button onClick={() => navigate('/upload')} className="flex items-center justify-center -mt-8 w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg hover:scale-110 active:scale-95 transition-all">
          <Upload className="h-6 w-6" />
        </button>
        <button onClick={() => navigate('/messages')} className={`relative flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${isActive('/messages') ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
          <div className="relative">
            <MessageCircle className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-2 -right-2 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </div>
          <span className="text-[10px] font-semibold">Chat</span>
        </button>
        <button onClick={() => navigate(currentUserId ? `/profile/${currentUserId}` : '/profile')} className={`flex flex-col items-center gap-1 px-3 py-2 rounded-2xl transition-all ${isActive('/profile') ? 'text-primary bg-primary/10' : 'text-muted-foreground hover:text-foreground'}`}>
          <User className="h-5 w-5" /><span className="text-[10px] font-semibold">Profile</span>
        </button>
      </div>
    </nav>
  );
};

export default BottomNav;
