import { useState, useRef, useEffect } from 'react';
import { ArrowLeft, Play, Pause, Heart, MessageCircle, Share2, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface NotificationVideoModalProps {
  videoId: string;
  onClose: () => void;
}

interface VideoData {
  id: string;
  title: string;
  description: string | null;
  video_url: string;
  thumbnail_url: string | null;
  views_count: number;
  likes_count: number;
  creator_id: string;
  creator?: {
    username: string;
    avatar_url: string | null;
    is_verified: boolean;
  };
}

const NotificationVideoModal = ({ videoId, onClose }: NotificationVideoModalProps) => {
  const [video, setVideo] = useState<VideoData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isMuted, setIsMuted] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const touchStartY = useRef(0);

  // Swipe down to close gesture
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;
    const currentY = e.touches[0].clientY;
    const diff = currentY - touchStartY.current;
    // Only allow dragging down
    if (diff > 0) {
      setDragY(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    // If dragged more than 100px, close the modal
    if (dragY > 100) {
      onClose();
    } else {
      setDragY(0);
    }
  };

  useEffect(() => {
    fetchVideo();
    checkIfLiked();
  }, [videoId]);

  const fetchVideo = async () => {
    try {
      const { data } = await supabase
        .from('videos')
        .select(`
          *,
          profiles:creator_id (
            username,
            avatar_url,
            is_verified
          )
        `)
        .eq('id', videoId)
        .single();

      if (data) {
        setVideo({
          ...data,
          creator: data.profiles as any
        });
        setLikesCount(data.likes_count);

        // Get signed URL for video
        const storagePath = data.video_url.replace(/.*\/videos\//, '');
        const { data: signedData, error } = await supabase.storage
          .from('videos')
          .createSignedUrl(storagePath, 3600);
        
        if (!error && signedData) {
          setSignedUrl(signedData.signedUrl);
        }

        // Increment views
        await supabase.rpc('increment_video_views', { _video_id: videoId });
      }
    } catch (error) {
      console.error('Error fetching video:', error);
      toast.error('Failed to load video');
    } finally {
      setLoading(false);
    }
  };

  const checkIfLiked = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('user_id', user.id)
      .eq('video_id', videoId)
      .maybeSingle();

    setIsLiked(!!data);
  };

  const handleLike = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    try {
      if (isLiked) {
        await supabase
          .from('likes')
          .delete()
          .eq('user_id', user.id)
          .eq('video_id', videoId);
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        await supabase
          .from('likes')
          .insert({ user_id: user.id, video_id: videoId });
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      toast.error('Failed to update like');
    }
  };

  const togglePlayPause = () => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleShare = async () => {
    try {
      await navigator.share({
        title: video?.title || 'Check out this video!',
        url: window.location.origin + `/feed?video=${videoId}`
      });
    } catch {
      toast.info('Copied to clipboard!');
      navigator.clipboard.writeText(window.location.origin + `/feed?video=${videoId}`);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center">
        <div className="bg-background rounded-3xl p-8 shadow-2xl">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  if (!video) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-background rounded-3xl p-8 shadow-2xl flex flex-col items-center gap-4">
          <p className="text-foreground">Video not found</p>
          <Button onClick={onClose} variant="outline" className="rounded-full">Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      {/* Swipe indicator */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 text-white/50 pointer-events-none">
        <div className="w-10 h-1 rounded-full bg-white/30" />
        <span className="text-xs">Swipe down to close</span>
      </div>

      {/* Standalone Video Preview Card */}
      <div 
        ref={cardRef}
        className="relative w-full max-w-sm aspect-[9/16] rounded-3xl overflow-hidden bg-black shadow-2xl transition-transform"
        style={{ 
          transform: `translateY(${dragY}px)`,
          opacity: 1 - (dragY / 300),
          transition: isDragging ? 'none' : 'transform 0.3s ease-out, opacity 0.3s ease-out'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 z-20 w-8 h-8 rounded-full bg-black/60 hover:bg-black/80 text-white flex items-center justify-center transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        {/* Video */}
        <div className="relative w-full h-full" onClick={togglePlayPause}>
          <video
            ref={videoRef}
            src={signedUrl || video.video_url}
            className="w-full h-full object-cover"
            autoPlay
            loop
            playsInline
            muted={isMuted}
          />

          {/* Play/Pause Overlay */}
          {!isPlaying && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/30">
              <div className="bg-white/20 backdrop-blur-sm rounded-full p-5">
                <Play className="h-10 w-10 text-white fill-white" />
              </div>
            </div>
          )}

          {/* Video Title Only - No Creator Info */}
          <div className="absolute bottom-0 left-0 right-14 p-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent">
            <h3 className="text-white font-bold text-base line-clamp-2">{video.title}</h3>
            {video.description && (
              <p className="text-white/70 text-xs mt-1 line-clamp-1">{video.description}</p>
            )}
          </div>

          {/* Minimal Side Actions */}
          <div className="absolute right-2 bottom-4 flex flex-col items-center gap-4">
            <button 
              onClick={(e) => { e.stopPropagation(); handleLike(); }}
              className="flex flex-col items-center gap-0.5"
            >
              <div className={`p-2 rounded-full ${isLiked ? 'bg-red-500' : 'bg-black/50'}`}>
                <Heart className={`h-5 w-5 ${isLiked ? 'text-white fill-white' : 'text-white'}`} />
              </div>
              <span className="text-white text-[10px]">{likesCount}</span>
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); toggleMute(); }}
              className="p-2 rounded-full bg-black/50"
            >
              {isMuted ? (
                <VolumeX className="h-5 w-5 text-white" />
              ) : (
                <Volume2 className="h-5 w-5 text-white" />
              )}
            </button>

            <button 
              onClick={(e) => { e.stopPropagation(); handleShare(); }}
              className="p-2 rounded-full bg-black/50"
            >
              <Share2 className="h-5 w-5 text-white" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotificationVideoModal;
