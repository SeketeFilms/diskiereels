import { useState, useEffect } from 'react';
import { Bell, Play, X, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import NotificationVideoModal from './NotificationVideoModal';

interface Notification {
  id: string;
  actor_id: string;
  type: string;
  video_id: string | null;
  comment_id: string | null;
  is_read: boolean;
  created_at: string;
  actor_profile: {
    username: string;
    avatar_url: string;
    user_type?: string;
  };
  video?: {
    title: string;
    thumbnail_url?: string;
  };
}

interface NotificationPreferences {
  likes_enabled: boolean;
  comments_enabled: boolean;
  follows_enabled: boolean;
  replies_enabled: boolean;
  new_videos_enabled: boolean;
  push_enabled: boolean;
  sound_enabled: boolean;
}

const NotificationBell = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [showBadgePreview, setShowBadgePreview] = useState(false);
  const [latestVideoNotification, setLatestVideoNotification] = useState<Notification | null>(null);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [viewingProfile, setViewingProfile] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    likes_enabled: true,
    comments_enabled: true,
    follows_enabled: true,
    replies_enabled: true,
    new_videos_enabled: true,
    push_enabled: false,
    sound_enabled: true,
  });

  useEffect(() => {
    fetchNotificationPreferences();
    fetchNotifications();
    
    // Set up real-time subscription
    const channel = supabase
      .channel('notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications'
        },
        (payload) => {
          const newNotification = payload.new as any;
          
          // Check if this type of notification is enabled
          const typeEnabled = 
            (newNotification.type === 'like' && preferences.likes_enabled) ||
            (newNotification.type === 'comment' && preferences.comments_enabled) ||
            (newNotification.type === 'follow' && preferences.follows_enabled) ||
            (newNotification.type === 'reply' && preferences.replies_enabled) ||
            (newNotification.type === 'new_video' && preferences.new_videos_enabled);
          
          if (typeEnabled) {
            // Play sound if enabled
            if (preferences.sound_enabled) {
              playNotificationSound();
            }
            
            // Trigger haptic feedback
            triggerHapticFeedback();
            
            // Show push notification if enabled and supported
            if (preferences.push_enabled && 'Notification' in window) {
              showPushNotification(newNotification);
            }
          }
          
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [preferences]);

  const fetchNotificationPreferences = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (data) {
      setPreferences({
        ...data,
        new_videos_enabled: (data as any).new_videos_enabled !== false,
      });
    }
  };

  const playNotificationSound = () => {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+Dy');
    audio.play().catch(() => {});
  };

  const triggerHapticFeedback = () => {
    if ('vibrate' in navigator) {
      navigator.vibrate(200);
    }
  };

  const showPushNotification = async (notification: any) => {
    if (Notification.permission === 'granted') {
      const registration = await navigator.serviceWorker.ready;
      registration.showNotification('ToonlyReels', {
        body: getNotificationText(notification),
        icon: '/toonreels-logo.png',
        badge: '/toonreels-logo.png',
      });
    } else if (Notification.permission !== 'denied') {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        showPushNotification(notification);
      }
    }
  };

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // First get notifications
    let query = supabase
      .from('notifications')
      .select(`
        *,
        video:videos(title, thumbnail_url)
      `)
      .eq('user_id', user.id);

    // Filter by preferences
    const enabledTypes = [];
    if (preferences.likes_enabled) enabledTypes.push('like');
    if (preferences.comments_enabled) enabledTypes.push('comment');
    if (preferences.follows_enabled) enabledTypes.push('follow');
    if (preferences.replies_enabled) enabledTypes.push('reply');
    if (preferences.new_videos_enabled) enabledTypes.push('new_video');

    if (enabledTypes.length > 0) {
      query = query.in('type', enabledTypes);
    }

    const { data } = await query
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      // Fetch actor profiles separately since the FK points to auth.users
      const actorIds = [...new Set(data.map(n => n.actor_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, user_type')
        .in('id', actorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      
      const enrichedNotifications = data.map(n => ({
        ...n,
        actor_profile: profileMap.get(n.actor_id) || { username: 'Unknown', avatar_url: null, user_type: 'viewer' }
      }));

      setNotifications(enrichedNotifications as any);
      setUnreadCount(enrichedNotifications.filter(n => !n.is_read).length);
      
      // Find latest unread new_video notification for badge preview
      const latestVideo = (enrichedNotifications as any[]).find(
        n => n.type === 'new_video' && !n.is_read && n.video?.thumbnail_url
      );
      if (latestVideo && !open) {
        setLatestVideoNotification(latestVideo);
        setShowBadgePreview(true);
      }
    }
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const markAllAsRead = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);

    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    setUnreadCount(0);
  };

  const handleNotificationClick = (notification: Notification, playVideo: boolean = false) => {
    markAsRead(notification.id);
    
    if (notification.type === 'follow') {
      // Set viewing profile - navigates within notification context
      setViewingProfile(notification.actor_id);
    } else if (notification.video_id) {
      // Show video in modal instead of navigating away
      setSelectedVideoId(notification.video_id);
    }
    // Keep sheet open - don't navigate away
  };

  const handleBackFromProfile = () => {
    setViewingProfile(null);
  };

  const handleBackFromVideo = () => {
    setSelectedVideoId(null);
  };

  const getNotificationText = (notification: Notification) => {
    const username = notification.actor_profile?.username || 'Someone';
    
    switch (notification.type) {
      case 'like':
        return `${username} liked your ${notification.comment_id ? 'comment' : 'video'}${notification.video?.title ? ` "${notification.video.title}"` : ''}`;
      case 'comment':
        return `${username} commented on your video${notification.video?.title ? ` "${notification.video.title}"` : ''}`;
      case 'reply':
        return `${username} replied to your comment`;
      case 'follow':
        return `${username} started following you`;
      case 'new_video':
        return `${username} uploaded a new video${notification.video?.title ? ` "${notification.video.title}"` : ''}`;
      case 'star_gift':
        return `${username} sent you stars! ⭐`;
      default:
        return 'New notification';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like':
        return '❤️';
      case 'comment':
        return '💬';
      case 'reply':
        return '↩️';
      case 'follow':
        return '👤';
      case 'new_video':
        return '🎬';
      case 'star_gift':
        return '⭐';
      default:
        return '🔔';
    }
  };

  const handleBadgePreviewClick = () => {
    if (latestVideoNotification) {
      markAsRead(latestVideoNotification.id);
      navigate(`/feed?video=${latestVideoNotification.video_id}`);
      setShowBadgePreview(false);
      setLatestVideoNotification(null);
    }
  };

  const dismissBadgePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowBadgePreview(false);
    setLatestVideoNotification(null);
  };

  return (
    <div className="relative">
      {/* Badge Preview Popup */}
      {showBadgePreview && latestVideoNotification && !open && (
        <div 
          className="absolute -top-2 right-12 z-50 animate-in slide-in-from-right-2 fade-in duration-300"
          onClick={handleBadgePreviewClick}
        >
          <div className="bg-card border border-border rounded-lg shadow-lg overflow-hidden w-48 cursor-pointer group">
            <div className="relative aspect-video">
              {latestVideoNotification.video?.thumbnail_url ? (
                <img 
                  src={latestVideoNotification.video.thumbnail_url} 
                  alt={latestVideoNotification.video?.title || 'New Video'} 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                  <Play className="h-6 w-6 text-primary/50" />
                </div>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div className="bg-white/90 rounded-full p-2">
                  <Play className="h-5 w-5 text-black fill-black" />
                </div>
              </div>
              <button
                onClick={dismissBadgePreview}
                className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 rounded-full p-1 transition-colors"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
            <div className="p-2 bg-card">
              <p className="text-xs font-medium text-foreground line-clamp-1">
                {latestVideoNotification.actor_profile?.username} uploaded
              </p>
              <p className="text-[10px] text-muted-foreground line-clamp-1">
                {latestVideoNotification.video?.title || 'New Video'}
              </p>
            </div>
          </div>
          {/* Arrow pointing to bell */}
          <div className="absolute top-1/2 -right-2 transform -translate-y-1/2">
            <div className="w-0 h-0 border-t-[6px] border-t-transparent border-b-[6px] border-b-transparent border-l-[6px] border-l-border"></div>
          </div>
        </div>
      )}

      {/* Video Modal - shows when a video notification is clicked */}
      {selectedVideoId && (
        <NotificationVideoModal 
          videoId={selectedVideoId} 
          onClose={handleBackFromVideo}
        />
      )}

      <Sheet open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (isOpen) {
          setShowBadgePreview(false);
        }
        if (!isOpen) {
          // Reset viewing states when sheet closes
          setViewingProfile(null);
          setSelectedVideoId(null);
        }
      }}>
        <SheetTrigger asChild>
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full relative"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center font-bold">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md">
          {/* Show profile view or notification list based on state */}
          {viewingProfile ? (
            <div className="h-full flex flex-col">
              <div className="flex items-center gap-3 mb-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleBackFromProfile}
                  className="rounded-full"
                >
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <h2 className="font-semibold">Follower Profile</h2>
              </div>
              <div className="flex-1 overflow-auto">
                <ProfilePreviewInSheet userId={viewingProfile} onClose={handleBackFromProfile} />
              </div>
            </div>
          ) : (
            <>
              <SheetHeader>
                <div className="flex items-center justify-between">
                  <SheetTitle>Notifications</SheetTitle>
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={markAllAsRead}
                      className="text-xs"
                    >
                      Mark all as read
                    </Button>
                  )}
                </div>
              </SheetHeader>
              <ScrollArea className="h-[calc(100vh-8rem)] mt-4">
                <div className="space-y-2">
                  {notifications.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <div
                        key={notification.id}
                        className={`p-4 rounded-lg transition-colors ${
                          notification.is_read
                            ? 'bg-background hover:bg-accent'
                            : 'bg-accent hover:bg-accent/80'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <Avatar 
                            className="h-10 w-10 cursor-pointer"
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <AvatarImage src={notification.actor_profile?.avatar_url} />
                            <AvatarFallback>
                              {notification.actor_profile?.username?.[0]?.toUpperCase() || '?'}
                            </AvatarFallback>
                          </Avatar>
                          <div 
                            className="flex-1 min-w-0 cursor-pointer"
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-sm font-medium leading-tight">
                                {getNotificationText(notification)}
                              </p>
                              <span className="text-xl flex-shrink-0">
                                {getNotificationIcon(notification.type)}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatDistanceToNow(new Date(notification.created_at), {
                                addSuffix: true,
                              })}
                            </p>
                          </div>
                        </div>
                        
                        {/* Video preview for new_video notifications */}
                        {notification.type === 'new_video' && notification.video_id && (
                          <div 
                            className="mt-3 ml-13 cursor-pointer group"
                            onClick={() => handleNotificationClick(notification, true)}
                          >
                            <div className="relative rounded-lg overflow-hidden bg-muted aspect-video max-w-[200px]">
                              {notification.video?.thumbnail_url ? (
                                <img 
                                  src={notification.video.thumbnail_url} 
                                  alt={notification.video?.title || 'Video'} 
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                                  <Play className="h-8 w-8 text-primary/50" />
                                </div>
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="bg-white/90 rounded-full p-2">
                                  <Play className="h-6 w-6 text-black fill-black" />
                                </div>
                              </div>
                              <div className="absolute bottom-1 left-1 right-1">
                                <p className="text-white text-[10px] font-medium drop-shadow-lg line-clamp-1 bg-black/50 px-1 rounded">
                                  {notification.video?.title || 'New Video'}
                                </p>
                              </div>
                            </div>
                            <p className="text-xs text-primary mt-1 group-hover:underline">
                              Tap to watch now →
                            </p>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
};

// Profile preview component for viewing within notification sheet
const ProfilePreviewInSheet = ({ userId, onClose }: { userId: string; onClose: () => void }) => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      setProfile(data);
      setLoading(false);
    };
    fetchProfile();
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <p>Profile not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center py-6">
        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center overflow-hidden mb-3">
          {profile.avatar_url ? (
            <img src={profile.avatar_url} alt={profile.username} className="w-full h-full object-cover" />
          ) : (
            <span className="text-3xl">{profile.selected_avatar || '🦊'}</span>
          )}
        </div>
        <h3 className="font-bold text-lg">@{profile.username}</h3>
        <span className="text-xs text-muted-foreground capitalize bg-muted px-2 py-1 rounded-full mt-1">
          {profile.user_type === 'creative' ? 'Creative' : 'Viewer'}
        </span>
        {profile.bio && (
          <p className="text-sm text-muted-foreground text-center mt-2 px-4">{profile.bio}</p>
        )}
      </div>
      <div className="text-center text-xs text-muted-foreground">
        <p>This user followed you!</p>
      </div>
    </div>
  );
};

export default NotificationBell;
