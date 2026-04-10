import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import StoryViewer from '@/components/StoryViewer';

interface Creator {
  id: string;
  username: string;
  avatar_url: string | null;
  selected_avatar: string | null;
  latest_video: {
    id: string;
    thumbnail_url: string | null;
  };
}

const StoryCircles = () => {
  const [creators, setCreators] = useState<Creator[]>([]);
  const [selectedCreator, setSelectedCreator] = useState<Creator | null>(null);

  useEffect(() => {
    fetchCreators();
  }, []);

  const fetchCreators = async () => {
    // Get all creators who have uploaded videos
    const { data: videos } = await supabase
      .from('videos')
      .select(`
        id,
        thumbnail_url,
        creator_id,
        created_at,
        profiles(id, username, avatar_url, selected_avatar)
      `)
      .order('created_at', { ascending: false });

    if (!videos) return;

    // Group by creator and get their latest video
    const creatorsMap = new Map<string, Creator>();
    
    videos.forEach((video: any) => {
      const creatorId = video.profiles?.id;
      if (!creatorId || creatorsMap.has(creatorId)) return;
      
      creatorsMap.set(creatorId, {
        id: creatorId,
        username: video.profiles.username,
        avatar_url: video.profiles.avatar_url,
        selected_avatar: video.profiles.selected_avatar,
        latest_video: {
          id: video.id,
          thumbnail_url: video.thumbnail_url,
        },
      });
    });

    setCreators(Array.from(creatorsMap.values()));
  };

  const handleCreatorClick = (creator: Creator) => {
    setSelectedCreator(creator);
  };

  if (creators.length === 0) return null;

  return (
    <>
      {selectedCreator && (
        <StoryViewer
          creatorId={selectedCreator.id}
          creatorName={selectedCreator.username}
          onClose={() => setSelectedCreator(null)}
        />
      )}
      
      <div className="fixed top-20 left-4 right-20 z-40 bg-card/95 backdrop-blur-lg rounded-full border-2 border-border shadow-lg">
      <ScrollArea className="w-full">
        <div className="flex gap-4 p-3">
          {creators.map((creator) => (
            <button
              key={creator.id}
              onClick={() => handleCreatorClick(creator)}
              className="flex flex-col items-center gap-2 shrink-0 group"
              aria-label={`View ${creator.username}'s stories`}
            >
              <div className="relative">
                {/* Gradient ring around avatar */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-tr from-primary via-accent to-[hsl(var(--fun-yellow))] p-[3px] group-hover:scale-110 transition-transform">
                  <div className="w-full h-full rounded-full bg-card flex items-center justify-center overflow-hidden">
                    {creator.avatar_url ? (
                      <img 
                        src={creator.avatar_url} 
                        alt={creator.username}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="text-2xl">
                        {creator.selected_avatar || '🦊'}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <span className="text-xs font-medium text-foreground max-w-[64px] truncate">
                {creator.username}
              </span>
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
    </>
  );
};

export default StoryCircles;
