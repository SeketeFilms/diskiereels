import { useState, useEffect } from 'react';
import { Bell, Check, ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import ResponsiveLayout from '@/components/ResponsiveLayout';

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

const Notifications = () => {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }

    const { data } = await supabase
      .from('notifications')
      .select(`
        *,
        video:videos(title, thumbnail_url)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
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

      setNotifications(enrichedNotifications as Notification[]);
    }
    setLoading(false);
  };

  const markAsRead = async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId);

    setNotifications(prev =>
      prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
    );
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
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    
    if (notification.type === 'follow') {
      navigate(`/profile/${notification.actor_id}`);
    } else if (notification.video_id) {
      navigate(`/feed?video=${notification.video_id}`);
    }
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

  const unreadCount = notifications.filter(n => !n.is_read).length;

  return (
    <ResponsiveLayout>
      <div className="min-h-screen bg-background pb-24 md:pb-4">
        <div className="max-w-2xl mx-auto p-4">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="md:hidden"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-black">Notifications</h1>
            </div>
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
                className="text-xs"
              >
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>

          <ScrollArea className="h-[calc(100vh-10rem)]">
            <div className="space-y-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No notifications yet</p>
                  <p className="text-sm mt-1">When someone interacts with your content, you'll see it here</p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 rounded-xl transition-all cursor-pointer ${
                      notification.is_read
                        ? 'bg-card hover:bg-accent'
                        : 'bg-primary/10 hover:bg-primary/15 border border-primary/20'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={notification.actor_profile?.avatar_url} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {notification.actor_profile?.username?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{getNotificationIcon(notification.type)}</span>
                          <p className={`text-sm ${notification.is_read ? 'text-muted-foreground' : 'font-medium'}`}>
                            {getNotificationText(notification)}
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </p>
                      </div>
                      {notification.video?.thumbnail_url && (
                        <img
                          src={notification.video.thumbnail_url}
                          alt=""
                          className="h-14 w-10 rounded-lg object-cover flex-shrink-0"
                        />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </ScrollArea>
        </div>
      </div>
    </ResponsiveLayout>
  );
};

export default Notifications;
