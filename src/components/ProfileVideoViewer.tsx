import { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import VideoPlayer from '@/components/VideoPlayer';

interface Video {
  id: string;
  title: string;
  thumbnail_url: string;
  views_count: number;
  likes_count: number;
  video_url: string;
  description: string;
  creator_id: string;
  creator_username?: string;
  creator_avatar_url?: string;
}

interface Profile {
  id?: string;
  username: string;
  user_type: string;
  bio: string;
  avatar_url: string;
  cover_photo_url?: string;
  is_verified?: boolean;
}

interface ProfileVideoViewerProps {
  videos: Video[];
  initialIndex: number;
  profile: Profile;
  currentUserId: string;
  onClose: () => void;
  onDelete: (videoId: string) => void;
}

const ProfileVideoViewer = ({
  videos,
  initialIndex,
  profile,
  currentUserId,
  onClose,
  onDelete
}: ProfileVideoViewerProps) => {
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const containerRef = useRef<HTMLDivElement>(null);
  const hasScrolledRef = useRef(false);

  // Scroll to initial video on mount
  useEffect(() => {
    if (containerRef.current && !hasScrolledRef.current) {
      const scrollPosition = initialIndex * window.innerHeight;
      containerRef.current.scrollTo({ top: scrollPosition, behavior: 'auto' });
      hasScrolledRef.current = true;
    }
  }, [initialIndex]);

  // Handle scroll to update active index
  const handleScroll = useCallback(() => {
    if (!containerRef.current) return;
    const scrollTop = containerRef.current.scrollTop;
    const height = window.innerHeight;
    const newIndex = Math.round(scrollTop / height);
    
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

  return (
    <div className="fixed inset-0 z-50 bg-background">
      <div 
        ref={containerRef}
        className="h-screen overflow-y-scroll snap-y snap-mandatory scrollbar-hide"
        style={{ 
          scrollSnapType: 'y mandatory',
          WebkitOverflowScrolling: 'touch',
          overscrollBehavior: 'none'
        }}
      >
        {videos.map((video, index) => {
          // For saved videos, use the creator's info, not the viewer's
          const isSavedVideo = profile.user_type === 'viewer';
          const videoProfiles = isSavedVideo 
            ? {
                username: video.creator_username || 'Unknown Creator',
                avatar_url: video.creator_avatar_url || '',
                is_verified: false,
              }
            : {
                username: profile?.username || '',
                avatar_url: profile?.avatar_url || '',
                is_verified: profile?.is_verified || false,
              };
          
          return (
            <div 
              key={video.id} 
              className="h-screen snap-start relative"
              style={{ scrollSnapAlign: 'start', scrollSnapStop: 'always' }}
            >
              <VideoPlayer
                video={{
                  ...video,
                  profiles: videoProfiles
                }}
                currentUserId={currentUserId}
                isPremium={false}
                isActive={index === activeIndex}
                onCommentsClick={() => {}}
                onDelete={() => onDelete(video.id)}
              />
            </div>
          );
        })}
      </div>
      <Button
        size="icon"
        variant="ghost"
        onClick={onClose}
        className="fixed top-4 left-4 z-50 rounded-full bg-black/50 text-white"
      >
        ✕
      </Button>
    </div>
  );
};

export default ProfileVideoViewer;
