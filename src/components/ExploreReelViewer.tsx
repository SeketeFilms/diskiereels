import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Heart, MessageCircle, Bookmark, Share2, BadgeCheck, Trash2 } from 'lucide-react';
import VideoPlayer from '@/components/VideoPlayer';
import CommentsSheet from '@/components/CommentsSheet';
import { supabase } from '@/integrations/supabase/client';
import { useIsMobile } from '@/hooks/use-mobile';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { z } from 'zod';

const commentSchema = z.object({
  content: z.string().trim().min(1).max(500),
});

interface Video {
  id: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
  video_url: string;
  likes_count: number;
  views_count: number;
  tags: string[] | null;
  creator_id: string;
  subtitles?: any;
  profiles: {
    username: string;
    avatar_url: string;
    is_verified: boolean;
  };
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  profiles: {
    username: string;
    avatar_url: string | null;
    selected_avatar: string | null;
  };
}

interface ExploreReelViewerProps {
  videos: Video[];
  startIndex: number;
  sectionTitle: string;
  onClose: () => void;
}

// Desktop comments panel component
const DesktopCommentsPanel = ({ video, currentUserId }: { video: Video; currentUserId: string }) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes_count);
  const [saved, setSaved] = useState(false);
  const [commentsCount, setCommentsCount] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchComments();
    fetchInteractionState();
  }, [video.id]);

  const fetchInteractionState = async () => {
    if (!currentUserId) return;
    const [likeRes, saveRes] = await Promise.allSettled([
      supabase.from('likes').select('id').eq('video_id', video.id).eq('user_id', currentUserId).maybeSingle(),
      supabase.from('saved_videos').select('id').eq('video_id', video.id).eq('user_id', currentUserId).maybeSingle(),
    ]);
    if (likeRes.status === 'fulfilled') setLiked(!!likeRes.value.data);
    if (saveRes.status === 'fulfilled') setSaved(!!saveRes.value.data);
  };

  const fetchComments = async () => {
    const { data, count } = await supabase
      .from('comments')
      .select('*, profiles(username, avatar_url, selected_avatar)', { count: 'exact' })
      .eq('video_id', video.id)
      .is('parent_id', null)
      .order('created_at', { ascending: false })
      .limit(50);
    setComments(data || []);
    setCommentsCount(count || 0);
  };

  const handleLike = async () => {
    if (!currentUserId) return;
    if (liked) {
      await supabase.from('likes').delete().eq('video_id', video.id).eq('user_id', currentUserId);
      setLiked(false);
      setLikesCount(prev => prev - 1);
    } else {
      await supabase.from('likes').insert({ video_id: video.id, user_id: currentUserId });
      setLiked(true);
      setLikesCount(prev => prev + 1);
    }
  };

  const handleSave = async () => {
    if (!currentUserId) return;
    if (saved) {
      await supabase.from('saved_videos').delete().eq('video_id', video.id).eq('user_id', currentUserId);
      setSaved(false);
      toast.success('Removed from saved');
    } else {
      await supabase.from('saved_videos').insert({ video_id: video.id, user_id: currentUserId });
      setSaved(true);
      toast.success('Saved!');
    }
  };

  const handleSubmitComment = async () => {
    const result = commentSchema.safeParse({ content: newComment });
    if (!result.success || !currentUserId) return;
    await supabase.from('comments').insert({
      video_id: video.id,
      user_id: currentUserId,
      content: result.data.content,
    });
    setNewComment('');
    fetchComments();
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h`;
    return `${Math.floor(hrs / 24)}d`;
  };

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Creator info header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={video.profiles.avatar_url} />
            <AvatarFallback>{video.profiles.username[0]?.toUpperCase()}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1">
              <span className="font-bold text-sm text-foreground truncate">{video.profiles.username}</span>
              {video.profiles.is_verified && <BadgeCheck className="h-4 w-4 text-primary flex-shrink-0" />}
            </div>
            <p className="text-xs text-muted-foreground truncate">{video.title}</p>
          </div>
        </div>
        {video.description && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{video.description}</p>
        )}
      </div>

      {/* Interaction bar */}
      <div className="flex items-center gap-6 px-4 py-3 border-b border-border">
        <button onClick={handleLike} className="flex items-center gap-1.5 group">
          <Heart className={`h-5 w-5 transition-colors ${liked ? 'fill-destructive text-destructive' : 'text-muted-foreground group-hover:text-foreground'}`} />
          <span className="text-xs font-semibold text-muted-foreground">{likesCount}</span>
        </button>
        <div className="flex items-center gap-1.5">
          <MessageCircle className="h-5 w-5 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground">{commentsCount}</span>
        </div>
        <button onClick={handleSave} className="flex items-center gap-1.5 group ml-auto">
          <Bookmark className={`h-5 w-5 transition-colors ${saved ? 'fill-primary text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
        </button>
      </div>

      {/* Comments list */}
      <ScrollArea className="flex-1 px-4">
        <div className="space-y-4 py-3">
          {comments.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">No comments yet. Be the first! 💬</p>
          )}
          {comments.map(comment => (
            <div key={comment.id} className="flex gap-2.5 group">
              <Avatar className="h-8 w-8 flex-shrink-0">
                {comment.profiles.selected_avatar ? (
                  <AvatarFallback className="text-lg">{comment.profiles.selected_avatar}</AvatarFallback>
                ) : (
                  <>
                    <AvatarImage src={comment.profiles.avatar_url || ''} />
                    <AvatarFallback>{comment.profiles.username[0]?.toUpperCase()}</AvatarFallback>
                  </>
                )}
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-foreground">{comment.profiles.username}</span>
                  <span className="text-[10px] text-muted-foreground">{formatTime(comment.created_at)}</span>
                  {comment.user_id === currentUserId && (
                    <button
                      onClick={async () => {
                        await supabase.from('comments').delete().eq('id', comment.id).eq('user_id', currentUserId);
                        fetchComments();
                        toast.success('Comment deleted');
                      }}
                      className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-sm text-foreground/90 mt-0.5">{comment.content}</p>
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>

      {/* Comment input */}
      <div className="p-3 border-t border-border">
        <div className="flex gap-2">
          <Textarea
            ref={textareaRef}
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitComment(); } }}
            placeholder="Add a comment..."
            className="min-h-[36px] max-h-[80px] resize-none text-sm"
            rows={1}
          />
          <Button size="icon" onClick={handleSubmitComment} disabled={!newComment.trim()} className="flex-shrink-0 h-9 w-9">
            <MessageCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const ExploreReelViewer = ({ videos, startIndex, sectionTitle, onClose }: ExploreReelViewerProps) => {
  const [activeIndex, setActiveIndex] = useState(startIndex);
  const [commentsVideoId, setCommentsVideoId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const containerRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setCurrentUserId(user.id);
    });
  }, []);

  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const scrollTop = container.scrollTop;
    const viewportHeight = container.clientHeight;
    const newIndex = Math.round(scrollTop / viewportHeight);
    if (newIndex !== activeIndex && newIndex >= 0 && newIndex < videos.length) {
      setActiveIndex(newIndex);
    }
  }, [activeIndex, videos.length]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({ top: startIndex * containerRef.current.clientHeight });
    }
  }, []);

  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Desktop/Tablet: Full-screen layout with comments panel
  if (!isMobile) {
    return (
      <div className="fixed inset-0 z-[60] bg-black flex">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-50 bg-black/40 rounded-full p-2 text-white hover:bg-black/60 transition-colors"
        >
          <X className="h-6 w-6" />
        </button>

        {/* Section title */}
        <div className="absolute top-4 left-4 z-50">
          <span className="text-white font-semibold text-sm bg-black/40 px-3 py-1.5 rounded-full">{sectionTitle}</span>
        </div>

        {/* Video side - centered, rounded container filling height */}
        <div className="flex-1 h-full flex items-center justify-center p-4 pr-0">
          <div
            ref={containerRef}
            className="h-full w-full max-w-[480px] overflow-y-scroll snap-y snap-mandatory rounded-2xl"
            style={{ scrollSnapType: 'y mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          >
            <style>{`div::-webkit-scrollbar { display: none; }`}</style>
            {videos.map((video, index) => {
              const shouldRender = Math.abs(index - activeIndex) <= 1;
              return (
                <div
                  key={video.id}
                  className="w-full snap-start snap-always relative overflow-hidden"
                  style={{ scrollSnapAlign: 'start', height: '100%' }}
                >
                  {shouldRender ? (
                    <VideoPlayer
                      video={video}
                      isActive={index === activeIndex}
                      onCommentsClick={() => {}}
                      currentUserId={currentUserId}
                      isPremium={false}
                    />
                  ) : (
                    <div className="h-full w-full bg-black" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Comments side panel - no border line */}
        <div className="w-[360px] h-full">
          <DesktopCommentsPanel
            key={videos[activeIndex]?.id}
            video={videos[activeIndex]}
            currentUserId={currentUserId}
          />
        </div>
      </div>
    );
  }

  // Mobile: Full-screen vertical scroll
  return (
    <div className="fixed inset-0 z-[60] bg-black">
      <div className="absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/60 to-transparent">
        <span className="text-white font-semibold text-sm truncate max-w-[70%]">{sectionTitle}</span>
        <button
          onClick={onClose}
          className="bg-black/40 rounded-full p-2 text-white hover:bg-black/60 transition-colors"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div
        ref={containerRef}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory"
        style={{ scrollSnapType: 'y mandatory' }}
      >
        {videos.map((video, index) => {
          const shouldRender = Math.abs(index - activeIndex) <= 1;
          return (
            <div
              key={video.id}
              className="h-screen w-full snap-start snap-always"
              style={{ scrollSnapAlign: 'start' }}
            >
              {shouldRender ? (
                <VideoPlayer
                  video={video}
                  isActive={index === activeIndex}
                  onCommentsClick={() => setCommentsVideoId(video.id)}
                  currentUserId={currentUserId}
                  isPremium={false}
                />
              ) : (
                <div className="h-full w-full bg-black" />
              )}
            </div>
          );
        })}
      </div>

      {commentsVideoId && (
        <CommentsSheet
          videoId={commentsVideoId}
          isOpen={!!commentsVideoId}
          onClose={() => setCommentsVideoId(null)}
          currentUserId={currentUserId}
        />
      )}
    </div>
  );
};

export default ExploreReelViewer;
