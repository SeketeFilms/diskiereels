import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useSignedVideoUrl } from '@/hooks/useSignedVideoUrl';

interface Video {
  id: string;
  video_url: string;
  title: string;
  description: string;
  thumbnail_url: string | null;
}

interface StoryViewerProps {
  creatorId: string;
  creatorName: string;
  onClose: () => void;
}

const StoryViewer = ({ creatorId, creatorName, onClose }: StoryViewerProps) => {
  const [videos, setVideos] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const { signedUrl, loading, error } = useSignedVideoUrl(videos[currentIndex]?.video_url);

  useEffect(() => {
    fetchCreatorVideos();
  }, [creatorId]);

  const fetchCreatorVideos = async () => {
    const { data } = await supabase
      .from('videos')
      .select('id, video_url, title, description, thumbnail_url')
      .eq('creator_id', creatorId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (data) {
      setVideos(data);
    }
  };

  const goToNext = () => {
    if (currentIndex < videos.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      onClose();
    }
  };

  const goToPrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  if (videos.length === 0) return null;

  const currentVideo = videos[currentIndex];

  return (
    <div className="fixed inset-0 z-50 bg-background">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 bg-gradient-to-b from-background/80 to-transparent p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🦊</span>
            <div>
              <p className="font-bold text-foreground">{creatorName}</p>
              <p className="text-xs text-muted-foreground">
                {currentIndex + 1} / {videos.length}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Progress bars */}
        <div className="flex gap-1 mt-3">
          {videos.map((_, index) => (
            <div
              key={index}
              className="h-1 flex-1 rounded-full bg-muted overflow-hidden"
            >
              <div
                className={`h-full bg-primary transition-all duration-300 ${
                  index < currentIndex
                    ? 'w-full'
                    : index === currentIndex
                    ? 'w-1/2'
                    : 'w-0'
                }`}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Video */}
      <div className="h-full flex items-center justify-center bg-black">
        {loading ? (
          <div className="text-white">Loading...</div>
        ) : error ? (
          <div className="text-white">Error loading video</div>
        ) : (
          <video
            key={signedUrl}
            src={signedUrl}
            className="h-full w-full object-contain"
            autoPlay
            controls
            onEnded={goToNext}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="absolute inset-0 flex items-center justify-between pointer-events-none z-10">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPrevious}
          disabled={currentIndex === 0}
          className="pointer-events-auto ml-4 rounded-full bg-background/20 backdrop-blur-sm"
        >
          <ChevronLeft className="h-6 w-6 text-white" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNext}
          className="pointer-events-auto mr-4 rounded-full bg-background/20 backdrop-blur-sm"
        >
          <ChevronRight className="h-6 w-6 text-white" />
        </Button>
      </div>

      {/* Video info overlay */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-background/80 to-transparent p-6">
        <h3 className="text-xl font-bold text-foreground mb-2">
          {currentVideo.title}
        </h3>
        {currentVideo.description && (
          <p className="text-sm text-muted-foreground">
            {currentVideo.description}
          </p>
        )}
      </div>
    </div>
  );
};

export default StoryViewer;
