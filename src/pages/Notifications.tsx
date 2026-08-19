import { useState, useEffect, useRef } from 'react';
import { Bell, Check, ArrowLeft, MessageCircle, Search, Send, CheckCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import ResponsiveLayout from '@/components/ResponsiveLayout';
import { toast } from 'sonner';

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

interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  selected_avatar: string | null;
}

interface Conversation {
  id: string;
  participant_one: string;
  participant_two: string;
  last_message_at: string;
  other_user: Profile;
  last_message?: string;
  unread_count: number;
}

interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

const Notifications = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'notifications' | 'inbox'>('notifications');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  // Inbox state
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [inboxUnread, setInboxUnread] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      setCurrentUserId(user.id);
      fetchNotifications(user.id);
      fetchConversations(user.id);
    };
    init();
  }, []);

  // Realtime for inbox
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel('notif-page-conversations')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, () => fetchConversations(currentUserId))
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  useEffect(() => {
    if (!selectedConversation) return;
    const channel = supabase
      .channel('notif-page-messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${selectedConversation.id}` }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => [...prev, newMsg]);
        if (newMsg.sender_id !== currentUserId) {
          supabase.from('messages').update({ is_read: true }).eq('id', newMsg.id).then();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConversation, currentUserId]);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  // === Notifications logic ===
  const fetchNotifications = async (userId?: string) => {
    let uid = userId;
    if (!uid) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      uid = user.id;
    }

    const { data } = await supabase
      .from('notifications')
      .select('*, video:videos(title, thumbnail_url)')
      .eq('user_id', uid)
      .order('created_at', { ascending: false })
      .limit(50);

    if (data) {
      const actorIds = [...new Set(data.map(n => n.actor_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, user_type')
        .in('id', actorIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      const enriched = data.map(n => ({
        ...n,
        actor_profile: profileMap.get(n.actor_id) || { username: 'Unknown', avatar_url: null, user_type: 'viewer' }
      }));
      setNotifications(enriched as Notification[]);
    }
    setLoading(false);
  };

  const markAsRead = async (notificationId: string) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', notificationId);
    setNotifications(prev => prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!currentUserId) return;
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', currentUserId).eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.type === 'follow') navigate(`/profile/${notification.actor_id}`);
    else if (notification.video_id) navigate(`/feed?video=${notification.video_id}`);
  };

  const getNotificationText = (notification: Notification) => {
    const username = notification.actor_profile?.username || 'Someone';
    switch (notification.type) {
      case 'like': return `${username} liked your ${notification.comment_id ? 'comment' : 'video'}${notification.video?.title ? ` "${notification.video.title}"` : ''}`;
      case 'comment': return `${username} commented on your video${notification.video?.title ? ` "${notification.video.title}"` : ''}`;
      case 'reply': return `${username} replied to your comment`;
      case 'follow': return `${username} started following you`;
      case 'new_video': return `${username} uploaded a new reel — you follow them${notification.video?.title ? ` · "${notification.video.title}"` : ''}`;
      case 'star_gift': return `${username} sent you stars! ⭐`;
      default: return 'New notification';
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'like': return '❤️';
      case 'comment': return '💬';
      case 'reply': return '↩️';
      case 'follow': return '👤';
      case 'new_video': return '🎬';
      case 'star_gift': return '⭐';
      default: return '🔔';
    }
  };

  // === Inbox logic ===
  const fetchConversations = async (userId: string) => {
    const { data: convos } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (!convos) return;
    let totalUnread = 0;
    const enriched: Conversation[] = [];
    for (const c of convos) {
      const otherId = c.participant_one === userId ? c.participant_two : c.participant_one;
      const { data: profile } = await supabase.from('profiles').select('id, username, avatar_url, selected_avatar').eq('id', otherId).single();
      const { data: lastMsg } = await supabase.from('messages').select('content').eq('conversation_id', c.id).order('created_at', { ascending: false }).limit(1).maybeSingle();
      const { count } = await supabase.from('messages').select('*', { count: 'exact', head: true }).eq('conversation_id', c.id).eq('is_read', false).neq('sender_id', userId);
      const uc = count || 0;
      totalUnread += uc;
      enriched.push({
        ...c,
        other_user: profile || { id: otherId, username: 'Unknown', avatar_url: null, selected_avatar: null },
        last_message: lastMsg?.content,
        unread_count: uc,
      });
    }
    setConversations(enriched);
    setInboxUnread(totalUnread);
  };

  const searchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase.from('profiles').select('id, username, avatar_url, selected_avatar').neq('id', currentUserId).ilike('username', `%${query}%`).limit(10);
    setSearchResults(data || []);
  };

  const startConversation = async (otherUser: Profile) => {
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant_one.eq.${currentUserId},participant_two.eq.${otherUser.id}),and(participant_one.eq.${otherUser.id},participant_two.eq.${currentUserId})`)
      .maybeSingle();

    if (existing) {
      setSelectedConversation({ ...existing, other_user: otherUser, unread_count: 0 });
      fetchMessages(existing.id);
    } else {
      const { data: newConvo, error } = await supabase.from('conversations').insert({ participant_one: currentUserId, participant_two: otherUser.id }).select().single();
      if (error) { toast.error('Failed to start conversation'); return; }
      setSelectedConversation({ ...newConvo, other_user: otherUser, unread_count: 0 });
      setMessages([]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data } = await supabase.from('messages').select('*').eq('conversation_id', conversationId).order('created_at', { ascending: true });
    setMessages(data || []);
    await supabase.from('messages').update({ is_read: true }).eq('conversation_id', conversationId).neq('sender_id', currentUserId);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({ conversation_id: selectedConversation.id, sender_id: currentUserId, content: newMessage.trim() });
    if (!error) {
      await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', selectedConversation.id);
      setNewMessage('');
    } else { toast.error('Failed to send message'); }
    setSending(false);
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
    if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const unreadNotifCount = notifications.filter(n => !n.is_read).length;

  // Chat view (inside inbox tab)
  if (selectedConversation) {
    return (
      <ResponsiveLayout>
        <div className="min-h-screen bg-background flex flex-col">
          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-lg border-b border-border p-3 flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => { setSelectedConversation(null); fetchConversations(currentUserId); }}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <Avatar className="h-9 w-9">
              <AvatarImage src={selectedConversation.other_user.avatar_url || undefined} />
              <AvatarFallback className="bg-primary text-primary-foreground text-sm font-bold">
                {selectedConversation.other_user.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="font-bold text-sm">{selectedConversation.other_user.username}</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <MessageCircle className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Start the conversation! ⚽</p>
              </div>
            )}
            {messages.map((msg) => {
              const isMine = msg.sender_id === currentUserId;
              return (
                <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-2xl px-4 py-2 ${isMine ? 'bg-primary text-primary-foreground rounded-br-md' : 'bg-card border border-border rounded-bl-md'}`}>
                    <p className="text-sm break-words">{msg.content}</p>
                    <div className={`flex items-center gap-1 mt-1 ${isMine ? 'justify-end' : ''}`}>
                      <span className={`text-[10px] ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{formatTime(msg.created_at)}</span>
                      {isMine && (msg.is_read ? <CheckCheck className="h-3 w-3 text-primary-foreground/60" /> : <Check className="h-3 w-3 text-primary-foreground/40" />)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          <div className="sticky bottom-0 bg-card/95 backdrop-blur-lg border-t border-border p-3 pb-20 md:pb-3">
            <div className="flex items-center gap-2">
              <Input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()} placeholder="Type a message..." className="flex-1" />
              <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim() || sending} className="rounded-full shrink-0">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="min-h-screen bg-background pb-24 md:pb-4">
        <div className="max-w-2xl mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="md:hidden">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-2xl font-black">Notifications</h1>
            </div>
            {activeTab === 'notifications' && unreadNotifCount > 0 && (
              <Button variant="outline" size="sm" onClick={markAllAsRead} className="text-xs">
                <Check className="h-3 w-3 mr-1" />
                Mark all read
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('notifications')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'notifications' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent'}`}
            >
              <Bell className="h-4 w-4 inline mr-1.5" />
              Activity
              {unreadNotifCount > 0 && (
                <span className="ml-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveTab('inbox')}
              className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${activeTab === 'inbox' ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground hover:bg-accent'}`}
            >
              <MessageCircle className="h-4 w-4 inline mr-1.5" />
              Inbox
              {inboxUnread > 0 && (
                <span className="ml-1.5 bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {inboxUnread > 9 ? '9+' : inboxUnread}
                </span>
              )}
            </button>
          </div>

          {activeTab === 'notifications' ? (
            <ScrollArea className="h-[calc(100vh-14rem)]">
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
                      className={`p-4 rounded-xl transition-all cursor-pointer ${notification.is_read ? 'bg-card hover:bg-accent' : 'bg-primary/10 hover:bg-primary/15 border border-primary/20'}`}
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
                          <img src={notification.video.thumbnail_url} alt="" className="h-14 w-10 rounded-lg object-cover flex-shrink-0" />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          ) : (
            /* Inbox tab */
            <div>
              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input value={searchQuery} onChange={(e) => searchUsers(e.target.value)} placeholder="Search users to chat..." className="pl-10" />
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 mb-4">
                  <p className="text-xs text-muted-foreground font-semibold">Search Results</p>
                  {searchResults.map((user) => (
                    <Card key={user.id} onClick={() => startConversation(user)} className="p-3 cursor-pointer hover:shadow-elevated transition-all">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground font-bold">{user.username[0].toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <p className="font-bold text-sm">{user.username}</p>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              <ScrollArea className="h-[calc(100vh-18rem)]">
                <div className="space-y-2">
                  {conversations.length === 0 && searchResults.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      <MessageCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p className="text-lg font-medium">No messages yet</p>
                      <p className="text-sm mt-2">Search for users to start chatting! ⚽</p>
                    </div>
                  ) : (
                    conversations.map((convo) => (
                      <Card
                        key={convo.id}
                        onClick={() => { setSelectedConversation(convo); fetchMessages(convo.id); }}
                        className="p-4 hover:shadow-elevated transition-all cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <Avatar className="h-12 w-12">
                            <AvatarImage src={convo.other_user.avatar_url || undefined} />
                            <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">{convo.other_user.username[0].toUpperCase()}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="font-bold">{convo.other_user.username}</p>
                            {convo.last_message && <p className="text-sm text-muted-foreground truncate">{convo.last_message}</p>}
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <span className="text-[10px] text-muted-foreground">{formatTime(convo.last_message_at)}</span>
                            {convo.unread_count > 0 && (
                              <span className="bg-primary text-primary-foreground text-[10px] font-bold h-5 min-w-5 flex items-center justify-center rounded-full px-1">{convo.unread_count}</span>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>
      </div>
    </ResponsiveLayout>
  );
};

export default Notifications;
