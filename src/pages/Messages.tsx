import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, MessageCircle, ArrowLeft, Send, Check, CheckCheck } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import BottomNav from '@/components/BottomNav';
import { toast } from 'sonner';

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

const Messages = () => {
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);
      fetchConversations(user.id);
    };
    init();
  }, []);

  // Realtime conversations
  useEffect(() => {
    if (!currentUserId) return;
    const channel = supabase
      .channel('conversations-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'conversations',
      }, () => {
        fetchConversations(currentUserId);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [currentUserId]);

  // Realtime messages
  useEffect(() => {
    if (!selectedConversation) return;
    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
        filter: `conversation_id=eq.${selectedConversation.id}`,
      }, (payload) => {
        const newMsg = payload.new as Message;
        setMessages(prev => [...prev, newMsg]);
        // Mark as read if from other user
        if (newMsg.sender_id !== currentUserId) {
          supabase.from('messages').update({ is_read: true }).eq('id', newMsg.id).then();
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConversation, currentUserId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchConversations = async (userId: string) => {
    const { data: convos } = await supabase
      .from('conversations')
      .select('*')
      .or(`participant_one.eq.${userId},participant_two.eq.${userId}`)
      .order('last_message_at', { ascending: false });

    if (!convos) return;

    const enriched: Conversation[] = [];
    for (const c of convos) {
      const otherId = c.participant_one === userId ? c.participant_two : c.participant_one;
      const { data: profile } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, selected_avatar')
        .eq('id', otherId)
        .single();

      const { data: lastMsg } = await supabase
        .from('messages')
        .select('content')
        .eq('conversation_id', c.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      const { count } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('conversation_id', c.id)
        .eq('is_read', false)
        .neq('sender_id', userId);

      enriched.push({
        ...c,
        other_user: profile || { id: otherId, username: 'Unknown', avatar_url: null, selected_avatar: null },
        last_message: lastMsg?.content,
        unread_count: count || 0,
      });
    }
    setConversations(enriched);
  };

  const searchUsers = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) { setSearchResults([]); return; }
    const { data } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, selected_avatar')
      .neq('id', currentUserId)
      .ilike('username', `%${query}%`)
      .limit(10);
    setSearchResults(data || []);
  };

  const startConversation = async (otherUser: Profile) => {
    // Check if conversation exists
    const { data: existing } = await supabase
      .from('conversations')
      .select('*')
      .or(`and(participant_one.eq.${currentUserId},participant_two.eq.${otherUser.id}),and(participant_one.eq.${otherUser.id},participant_two.eq.${currentUserId})`)
      .maybeSingle();

    if (existing) {
      setSelectedConversation({ ...existing, other_user: otherUser, unread_count: 0 });
      fetchMessages(existing.id);
    } else {
      const { data: newConvo, error } = await supabase
        .from('conversations')
        .insert({ participant_one: currentUserId, participant_two: otherUser.id })
        .select()
        .single();
      if (error) { toast.error('Failed to start conversation'); return; }
      setSelectedConversation({ ...newConvo, other_user: otherUser, unread_count: 0 });
      setMessages([]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const fetchMessages = async (conversationId: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages(data || []);
    // Mark all as read
    await supabase
      .from('messages')
      .update({ is_read: true })
      .eq('conversation_id', conversationId)
      .neq('sender_id', currentUserId);
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || sending) return;
    setSending(true);
    const { error } = await supabase.from('messages').insert({
      conversation_id: selectedConversation.id,
      sender_id: currentUserId,
      content: newMessage.trim(),
    });
    if (!error) {
      await supabase.from('conversations').update({ last_message_at: new Date().toISOString() }).eq('id', selectedConversation.id);
      setNewMessage('');
    } else {
      toast.error('Failed to send message');
    }
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

  // Chat view
  if (selectedConversation) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        {/* Chat header */}
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

        {/* Messages */}
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
                    <span className={`text-[10px] ${isMine ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>
                      {formatTime(msg.created_at)}
                    </span>
                    {isMine && (
                      msg.is_read 
                        ? <CheckCheck className="h-3 w-3 text-primary-foreground/60" />
                        : <Check className="h-3 w-3 text-primary-foreground/40" />
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="sticky bottom-0 bg-card/95 backdrop-blur-lg border-t border-border p-3">
          <div className="flex items-center gap-2">
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button size="icon" onClick={sendMessage} disabled={!newMessage.trim() || sending} className="rounded-full shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Conversations list view
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-black mb-6">Messages</h1>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => searchUsers(e.target.value)}
            placeholder="Search users to chat..."
            className="pl-10"
          />
        </div>

        {/* Search results */}
        {searchResults.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-xs text-muted-foreground font-semibold">Search Results</p>
            {searchResults.map((user) => (
              <Card key={user.id} onClick={() => startConversation(user)} className="p-3 cursor-pointer hover:shadow-elevated transition-all">
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                      {user.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <p className="font-bold text-sm">{user.username}</p>
                </div>
              </Card>
            ))}
          </div>
        )}

        {/* Conversations */}
        <div className="space-y-2">
          {conversations.length === 0 && searchResults.length === 0 ? (
            <Card className="p-12 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Search for users to start chatting! ⚽
              </p>
            </Card>
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
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold text-lg">
                      {convo.other_user.username[0].toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold">{convo.other_user.username}</p>
                    {convo.last_message && (
                      <p className="text-sm text-muted-foreground truncate">{convo.last_message}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[10px] text-muted-foreground">
                      {formatTime(convo.last_message_at)}
                    </span>
                    {convo.unread_count > 0 && (
                      <span className="bg-primary text-primary-foreground text-[10px] font-bold h-5 min-w-5 flex items-center justify-center rounded-full px-1">
                        {convo.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </div>
      <BottomNav />
    </div>
  );
};

export default Messages;
