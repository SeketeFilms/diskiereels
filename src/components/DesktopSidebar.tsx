import { Film, Search, Upload, Bell, User, Settings } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import toonreelsLogo from '@/assets/toonreels-logo.png';
import SidebarMoreMenu from './SidebarMoreMenu';

// Persistent cache that survives component re-mounts
const creativeStatusCache = new Map<string, boolean>();
let cachedUserId: string | null = null;

// Hook to get unread notification count
const useUnreadNotifications = () => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchUnread = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { count } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);

      setUnreadCount(count || 0);
    };

    fetchUnread();

    // Subscribe to new notifications
    const channel = supabase
      .channel('sidebar-notifications')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications'
        },
        () => fetchUnread()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return unreadCount;
};

const DesktopSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const unreadCount = useUnreadNotifications();
  
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [isCreative, setIsCreative] = useState<boolean>(() => {
    if (cachedUserId && creativeStatusCache.has(cachedUserId)) {
      return creativeStatusCache.get(cachedUserId)!;
    }
    return false;
  });
  const [isLoaded, setIsLoaded] = useState(() => {
    return cachedUserId !== null && creativeStatusCache.has(cachedUserId);
  });
  
  const isMounted = useRef(true);
  const hasChecked = useRef(false);

  const checkUserType = useCallback(async (forceRefresh = false) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!isMounted.current) return;
      
      if (user) {
        cachedUserId = user.id;
        setCurrentUserId(user.id);
        
        if (!forceRefresh && creativeStatusCache.has(user.id)) {
          setIsCreative(creativeStatusCache.get(user.id)!);
          setIsLoaded(true);
          return;
        }
        
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id);
        
        if (!isMounted.current) return;
        
        const creative = roles?.some(r => r.role === 'creative') || false;
        creativeStatusCache.set(user.id, creative);
        setIsCreative(creative);
      } else {
        cachedUserId = null;
        setCurrentUserId(null);
        setIsCreative(false);
      }
    } catch {
      if (isMounted.current) {
        setIsCreative(false);
      }
    }
    
    if (isMounted.current) {
      setIsLoaded(true);
    }
  }, []);

  useEffect(() => {
    isMounted.current = true;
    
    if (!hasChecked.current || !isLoaded) {
      hasChecked.current = true;
      checkUserType();
    }
    
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        creativeStatusCache.clear();
        cachedUserId = null;
        checkUserType(true);
      } else if (event === 'SIGNED_OUT') {
        creativeStatusCache.clear();
        cachedUserId = null;
        setIsCreative(false);
        setCurrentUserId(null);
        setIsLoaded(true);
      }
    });
    
    return () => {
      isMounted.current = false;
      subscription.unsubscribe();
    };
  }, [checkUserType, isLoaded]);

  const isActive = (path: string) => {
    if (path === '/profile') {
      return location.pathname.startsWith('/profile');
    }
    return location.pathname === path;
  };

  // Main nav items - Reels, Explore, Upload (creative only), Notifications, Profile, Settings
  const navItems = [
    { path: '/feed', icon: Film, label: 'Toonz', badge: 0 },
    { path: '/search', icon: Search, label: 'Explore', badge: 0 },
    ...(isLoaded && isCreative ? [{ path: '/upload', icon: Upload, label: 'Upload', badge: 0 }] : []),
    { path: '/notifications', icon: Bell, label: 'Notifications', badge: unreadCount },
    { path: currentUserId ? `/profile/${currentUserId}` : '/profile', icon: User, label: 'Profile', badge: 0 },
    { path: '/settings', icon: Settings, label: 'Settings', badge: 0 },
  ];

  return (
    <aside className="hidden md:flex fixed left-0 top-0 bottom-0 w-56 lg:w-64 bg-card border-r border-border flex-col z-50">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-6 border-b border-border">
        <img src={toonreelsLogo} alt="ToonlyReels" className="w-10 h-10" />
        <span className="text-xl font-black text-foreground">ToonlyReels</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`w-full flex items-center gap-4 px-4 py-3 rounded-xl text-base font-semibold transition-all ${
              isActive(item.path)
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <div className="relative">
              <item.icon className="h-5 w-5" />
              {item.badge > 0 && (
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold">
                  {item.badge > 9 ? '9+' : item.badge}
                </span>
              )}
            </div>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* Footer with More Menu */}
      <div className="p-3 border-t border-border space-y-1">
        <SidebarMoreMenu isCreative={isCreative} />
        <p className="text-xs text-muted-foreground text-center py-2">© 2025 ToonlyReels</p>
      </div>
    </aside>
  );
};

export default DesktopSidebar;
