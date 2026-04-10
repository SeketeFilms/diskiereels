import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Heart, Send, Flag, Trash2, Ban, Reply, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { z } from 'zod';
import { useIsMobile } from '@/hooks/use-mobile';

const commentSchema = z.object({
  content: z.string()
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(500, 'Comment must be less than 500 characters')
});

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  parent_id: string | null;
  likes_count: number;
  is_liked: boolean;
  profiles: {
    username: string;
    avatar_url: string | null;
    selected_avatar: string | null;
  };
}

interface CommentsSheetProps {
  videoId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserId: string;
}

const CommentsSheet = ({ videoId, isOpen, onClose, currentUserId }: CommentsSheetProps) => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; username: string } | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<string[]>([]);
  const [expandedReplies, setExpandedReplies] = useState<Set<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isOpen) {
      fetchComments();
      fetchBlockedUsers();
    }
  }, [isOpen, videoId]);

  // Focus textarea when replying
  useEffect(() => {
    if (replyTo && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [replyTo]);

  const fetchBlockedUsers = async () => {
    if (!currentUserId) return;
    
    const { data } = await supabase
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', currentUserId);
    
    setBlockedUsers(data?.map(b => b.blocked_id) || []);
  };

  const fetchComments = async () => {
    // Fetch comments with profile info including avatar
    const { data: commentsData } = await supabase
      .from('comments')
      .select(`
        *,
        profiles(username, avatar_url, selected_avatar)
      `)
      .eq('video_id', videoId)
      .order('created_at', { ascending: false });

    if (!commentsData) {
      setComments([]);
      return;
    }

    // Fetch likes for all comments
    const commentIds = commentsData.map(c => c.id);
    const { data: likesData } = await supabase
      .from('comment_likes')
      .select('comment_id')
      .in('comment_id', commentIds)
      .eq('user_id', currentUserId);

    const likedCommentIds = new Set(likesData?.map(l => l.comment_id) || []);

    // Get like counts for all comments
    const { data: likeCounts } = await supabase
      .from('comment_likes')
      .select('comment_id')
      .in('comment_id', commentIds);

    const likeCountMap = new Map<string, number>();
    likeCounts?.forEach(l => {
      likeCountMap.set(l.comment_id, (likeCountMap.get(l.comment_id) || 0) + 1);
    });

    const enrichedComments = commentsData.map(c => ({
      ...c,
      likes_count: likeCountMap.get(c.id) || 0,
      is_liked: likedCommentIds.has(c.id)
    }));

    setComments(enrichedComments);
  };

  const handleSubmit = useCallback(async () => {
    try {
      const validation = commentSchema.safeParse({ content: newComment });
      
      if (!validation.success) {
        toast.error(validation.error.issues[0].message);
        return;
      }

      await supabase.from('comments').insert({
        video_id: videoId,
        user_id: currentUserId,
        content: validation.data.content,
        parent_id: replyTo?.id || null
      });

      setNewComment('');
      setReplyTo(null);
      fetchComments();
      toast.success(replyTo ? 'Reply posted!' : 'Comment posted!');
    } catch (error) {
      toast.error('Failed to post comment');
    }
  }, [newComment, videoId, currentUserId, replyTo]);

  const handleLikeComment = async (commentId: string, isCurrentlyLiked: boolean) => {
    try {
      if (isCurrentlyLiked) {
        await supabase
          .from('comment_likes')
          .delete()
          .eq('comment_id', commentId)
          .eq('user_id', currentUserId);
        
        setComments(prev => prev.map(c => 
          c.id === commentId 
            ? { ...c, is_liked: false, likes_count: c.likes_count - 1 }
            : c
        ));
      } else {
        await supabase.from('comment_likes').insert({
          comment_id: commentId,
          user_id: currentUserId
        });
        
        setComments(prev => prev.map(c => 
          c.id === commentId 
            ? { ...c, is_liked: true, likes_count: c.likes_count + 1 }
            : c
        ));
      }
    } catch (error) {
      // Handle conflict
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    try {
      await supabase.from('comments').delete().eq('id', commentId);
      fetchComments();
      toast.success('Comment deleted');
    } catch (error) {
      toast.error('Failed to delete comment');
    }
  };

  const handleReportComment = async (commentId: string) => {
    try {
      await supabase.from('reports').insert({
        reporter_id: currentUserId,
        reported_type: 'comment',
        reported_id: commentId,
        reason: 'Inappropriate comment'
      });
      toast.success('Comment reported');
    } catch (error) {
      toast.error('Failed to report comment');
    }
  };

  const handleBlockUser = async (userId: string) => {
    if (!currentUserId || userId === currentUserId) return;
    
    try {
      await supabase.from('blocks').insert({
        blocker_id: currentUserId,
        blocked_id: userId
      });
      setBlockedUsers(prev => [...prev, userId]);
      toast.success('User blocked');
    } catch (error) {
      toast.error('Failed to block user');
    }
  };

  const toggleReplies = (commentId: string) => {
    setExpandedReplies(prev => {
      const next = new Set(prev);
      if (next.has(commentId)) {
        next.delete(commentId);
      } else {
        next.add(commentId);
      }
      return next;
    });
  };

  const topLevelComments = comments.filter(c => !c.parent_id);
  const getReplies = (parentId: string) => comments.filter(c => c.parent_id === parentId);

  // Filter out comments from blocked users
  const visibleComments = topLevelComments.filter(c => !blockedUsers.includes(c.user_id));

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side={isMobile ? "bottom" : "right"} 
        className={isMobile ? "h-[80vh] rounded-t-3xl flex flex-col" : "w-[400px] sm:w-[450px] flex flex-col"}
      >
        <SheetHeader>
          <SheetTitle className="text-2xl font-black">Comments</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-4 py-4">
          {visibleComments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No comments yet</p>
              <p className="text-sm mt-1">Be the first to comment!</p>
            </div>
          ) : (
            visibleComments.map((comment) => {
              const replies = getReplies(comment.id).filter(r => !blockedUsers.includes(r.user_id));
              const isExpanded = expandedReplies.has(comment.id);

              return (
                <div key={comment.id} className="space-y-2">
                  <div className="flex gap-3">
                    {comment.profiles.avatar_url ? (
                      <img 
                        src={comment.profiles.avatar_url} 
                        alt={comment.profiles.username}
                        className="h-8 w-8 rounded-full object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center font-bold text-sm flex-shrink-0 text-primary-foreground">
                        {comment.profiles.selected_avatar || comment.profiles.username[0].toUpperCase()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{comment.profiles.username}</span>
                        <span className="text-xs text-muted-foreground">
                          {new Date(comment.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="text-sm mb-2 break-words">{comment.content}</p>
                      
                      <div className="flex items-center gap-1 flex-wrap">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleLikeComment(comment.id, comment.is_liked)}
                          className={`h-7 px-2 ${comment.is_liked ? 'text-red-500' : ''}`}
                        >
                          <Heart className={`h-3 w-3 mr-1 ${comment.is_liked ? 'fill-current' : ''}`} />
                          {comment.likes_count > 0 && comment.likes_count}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setReplyTo({ id: comment.id, username: comment.profiles.username })}
                          className="h-7 px-2"
                        >
                          <Reply className="h-3 w-3 mr-1" />
                          Reply
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleReportComment(comment.id)}
                          className="h-7 px-2 text-orange-500"
                        >
                          <Flag className="h-3 w-3" />
                        </Button>
                        {comment.user_id !== currentUserId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleBlockUser(comment.user_id)}
                            className="h-7 px-2 text-destructive"
                          >
                            <Ban className="h-3 w-3" />
                          </Button>
                        )}
                        {comment.user_id === currentUserId && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteComment(comment.id)}
                            className="h-7 px-2 text-destructive"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        )}
                      </div>

                      {/* Replies toggle */}
                      {replies.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleReplies(comment.id)}
                          className="h-7 px-2 mt-1 text-primary"
                        >
                          {isExpanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
                          {isExpanded ? 'Hide' : 'View'} {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Replies - only shown when expanded */}
                  {isExpanded && replies.map((reply) => (
                    <div key={reply.id} className="ml-12 flex gap-3">
                      {reply.profiles.avatar_url ? (
                        <img 
                          src={reply.profiles.avatar_url} 
                          alt={reply.profiles.username}
                          className="h-6 w-6 rounded-full object-cover flex-shrink-0"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-accent flex items-center justify-center font-bold text-xs flex-shrink-0">
                          {reply.profiles.selected_avatar || reply.profiles.username[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-semibold text-xs">{reply.profiles.username}</span>
                          <span className="text-xs text-muted-foreground">
                            {new Date(reply.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs break-words">{reply.content}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleLikeComment(reply.id, reply.is_liked)}
                            className={`h-6 px-1 ${reply.is_liked ? 'text-red-500' : ''}`}
                          >
                            <Heart className={`h-3 w-3 ${reply.is_liked ? 'fill-current' : ''}`} />
                            {reply.likes_count > 0 && <span className="ml-1 text-xs">{reply.likes_count}</span>}
                          </Button>
                          {reply.user_id !== currentUserId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleBlockUser(reply.user_id)}
                              className="h-6 px-1 text-destructive"
                            >
                              <Ban className="h-3 w-3" />
                            </Button>
                          )}
                          {reply.user_id === currentUserId && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteComment(reply.id)}
                              className="h-6 px-1 text-destructive"
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
          )}
        </div>

        <div className="border-t pt-4 mt-auto">
          {replyTo && (
            <div className="mb-2 text-sm text-muted-foreground flex items-center gap-2 bg-accent/50 px-3 py-2 rounded-lg">
              <Reply className="h-3 w-3" />
              <span>Replying to <strong>@{replyTo.username}</strong></span>
              <Button size="sm" variant="ghost" onClick={() => setReplyTo(null)} className="ml-auto h-6 px-2">
                Cancel
              </Button>
            </div>
          )}
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder={replyTo ? `Reply to @${replyTo.username}...` : "Add a comment..."}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              className="min-h-[40px] max-h-[120px] resize-none"
              rows={1}
            />
            <Button onClick={handleSubmit} size="icon" className="flex-shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default CommentsSheet;
