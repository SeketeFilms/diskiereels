import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Download, Eye, Heart, Play, Trophy, Share2, TrendingUp, TrendingDown } from 'lucide-react';
import { toast } from 'sonner';

interface TopCreator {
  id: string;
  username: string;
  avatar_url: string | null;
  is_verified: boolean;
  weeklyViews: number;
  weeklyLikes: number;
  videoCount: number;
  viewsGrowth: number; // Percentage growth from last week
  likesGrowth: number; // Percentage growth from last week
}

interface TopCreativesSectionProps {
  formatCount: (count: number) => string;
}

const TopCreativesSection = ({ formatCount }: TopCreativesSectionProps) => {
  const navigate = useNavigate();
  const [topCreators, setTopCreators] = useState<TopCreator[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [previewCreator, setPreviewCreator] = useState<TopCreator | null>(null);
  const [animationTriggered, setAnimationTriggered] = useState(false);

  useEffect(() => {
    fetchTopCreators();
  }, []);

  // Trigger animation after loading
  useEffect(() => {
    if (!isLoading && topCreators.length > 0) {
      // Small delay to ensure DOM is ready
      const timer = setTimeout(() => setAnimationTriggered(true), 100);
      return () => clearTimeout(timer);
    }
  }, [isLoading, topCreators]);

  const fetchTopCreators = async () => {
    setIsLoading(true);
    
    // Get the start of this week (Monday)
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diff = now.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
    const weekStart = new Date(now.setDate(diff));
    weekStart.setHours(0, 0, 0, 0);

    // Get start of last week
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    const lastWeekEnd = new Date(weekStart);
    lastWeekEnd.setMilliseconds(-1);

    // Fetch videos from this week with their creators
    const { data: thisWeekVideos } = await supabase
      .from('videos')
      .select(`
        creator_id,
        views_count,
        likes_count,
        created_at,
        profiles!videos_creator_id_fkey(id, username, avatar_url, is_verified)
      `)
      .gte('created_at', weekStart.toISOString());

    // Fetch videos from last week
    const { data: lastWeekVideos } = await supabase
      .from('videos')
      .select(`
        creator_id,
        views_count,
        likes_count
      `)
      .gte('created_at', lastWeekStart.toISOString())
      .lt('created_at', weekStart.toISOString());

    if (!thisWeekVideos || thisWeekVideos.length === 0) {
      setTopCreators([]);
      setIsLoading(false);
      return;
    }

    // Aggregate last week stats per creator
    const lastWeekStats: Record<string, { views: number; likes: number }> = {};
    (lastWeekVideos || []).forEach((video: any) => {
      if (!lastWeekStats[video.creator_id]) {
        lastWeekStats[video.creator_id] = { views: 0, likes: 0 };
      }
      lastWeekStats[video.creator_id].views += video.views_count || 0;
      lastWeekStats[video.creator_id].likes += video.likes_count || 0;
    });

    // Aggregate this week stats per creator
    const creatorStats: Record<string, TopCreator> = {};
    
    thisWeekVideos.forEach((video: any) => {
      const profile = video.profiles;
      if (!profile) return;
      
      if (!creatorStats[profile.id]) {
        creatorStats[profile.id] = {
          id: profile.id,
          username: profile.username,
          avatar_url: profile.avatar_url,
          is_verified: profile.is_verified || false,
          weeklyViews: 0,
          weeklyLikes: 0,
          videoCount: 0,
          viewsGrowth: 0,
          likesGrowth: 0
        };
      }
      
      creatorStats[profile.id].weeklyViews += video.views_count || 0;
      creatorStats[profile.id].weeklyLikes += video.likes_count || 0;
      creatorStats[profile.id].videoCount += 1;
    });

    // Calculate growth percentages
    Object.keys(creatorStats).forEach(id => {
      const lastWeek = lastWeekStats[id] || { views: 0, likes: 0 };
      const thisWeek = creatorStats[id];
      
      // Calculate percentage growth (avoid division by zero)
      thisWeek.viewsGrowth = lastWeek.views > 0 
        ? Math.round(((thisWeek.weeklyViews - lastWeek.views) / lastWeek.views) * 100)
        : thisWeek.weeklyViews > 0 ? 100 : 0;
      
      thisWeek.likesGrowth = lastWeek.likes > 0
        ? Math.round(((thisWeek.weeklyLikes - lastWeek.likes) / lastWeek.likes) * 100)
        : thisWeek.weeklyLikes > 0 ? 100 : 0;
    });

    // Sort by total engagement (views + likes)
    const sorted = Object.values(creatorStats)
      .sort((a, b) => (b.weeklyViews + b.weeklyLikes) - (a.weeklyViews + a.weeklyLikes))
      .slice(0, 5);

    setTopCreators(sorted);
    setIsLoading(false);
  };

  const generateCreatorCard = async (creator: TopCreator, rank: number) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1000;
    canvas.height = 1000;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Background gradient (red to orange)
    const gradient = ctx.createLinearGradient(0, 0, 1000, 1000);
    gradient.addColorStop(0, '#FF0000');
    gradient.addColorStop(0.5, '#F97316');
    gradient.addColorStop(1, '#FFD700');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 1000, 1000);

    // Add pattern overlay
    ctx.globalAlpha = 0.1;
    for (let i = 0; i < 20; i++) {
      ctx.beginPath();
      ctx.arc(Math.random() * 1000, Math.random() * 1000, Math.random() * 50 + 20, 0, Math.PI * 2);
      ctx.fillStyle = '#FFFFFF';
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Add "This Week's Top Creator" header
    ctx.font = 'bold 48px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText("🏆 This Week's Top Creator 🏆", 500, 80);

    // Rank badge
    ctx.font = 'bold 120px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32';
    ctx.fillText(`#${rank}`, 500, 220);

    // Draw profile picture if available
    if (creator.avatar_url) {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise<void>((resolve, reject) => {
          img.onload = () => resolve();
          img.onerror = () => reject();
          img.src = creator.avatar_url!;
        });
        
        // Draw circular avatar
        const avatarSize = 150;
        const avatarX = 500 - avatarSize / 2;
        const avatarY = 280;
        
        ctx.save();
        ctx.beginPath();
        ctx.arc(500, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(img, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
        
        // Add border around avatar
        ctx.beginPath();
        ctx.arc(500, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 6;
        ctx.stroke();
      } catch {
        // Profile picture failed to load, skip it
      }
    }

    // Creator name (adjusted position)
    ctx.font = 'bold 72px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 10;
    ctx.fillText(`@${creator.username}`, 500, creator.avatar_url ? 530 : 480);
    ctx.shadowBlur = 0;

    // Stats with growth indicators (adjusted positions)
    const statsStartY = creator.avatar_url ? 620 : 600;
    ctx.font = 'bold 56px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    
    const viewsGrowthText = creator.viewsGrowth >= 0 ? `+${creator.viewsGrowth}%` : `${creator.viewsGrowth}%`;
    const likesGrowthText = creator.likesGrowth >= 0 ? `+${creator.likesGrowth}%` : `${creator.likesGrowth}%`;
    
    ctx.fillText(`👁 ${formatCount(creator.weeklyViews)} views (${viewsGrowthText})`, 500, statsStartY);
    ctx.fillText(`❤️ ${formatCount(creator.weeklyLikes)} likes (${likesGrowthText})`, 500, statsStartY + 80);
    ctx.fillText(`🎬 ${creator.videoCount} videos`, 500, statsStartY + 160);

    // Footer with ToonlyReels branding
    ctx.font = 'bold 36px system-ui, -apple-system, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('ToonlyReels • Week of ' + new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), 500, 940);

    return canvas.toDataURL('image/png');
  };

  const handlePreview = async (creator: TopCreator, rank: number) => {
    const imageUrl = await generateCreatorCard(creator, rank);
    if (imageUrl) {
      setPreviewImage(imageUrl);
      setPreviewCreator(creator);
    }
  };

  const handleDownload = async (creator: TopCreator, rank: number) => {
    const imageUrl = await generateCreatorCard(creator, rank);
    if (!imageUrl) {
      toast.error('Failed to generate image');
      return;
    }

    const link = document.createElement('a');
    link.download = `toonlyreels-top-creator-${creator.username}.png`;
    link.href = imageUrl;
    link.click();
    toast.success('Image downloaded!');
  };

  const handleShare = async (creator: TopCreator, rank: number) => {
    const imageUrl = await generateCreatorCard(creator, rank);
    if (!imageUrl) {
      toast.error('Failed to generate image');
      return;
    }

    // Convert data URL to Blob
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    const file = new File([blob], `toonlyreels-top-creator-${creator.username}.png`, { type: 'image/png' });

    // Check if Web Share API supports sharing files
    if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: `🏆 #${rank} Top Creator on ToonlyReels`,
          text: `Check out @${creator.username} - This week's #${rank} top creator with ${formatCount(creator.weeklyViews)} views!`,
          files: [file]
        });
        toast.success('Shared successfully!');
      } catch (error: any) {
        if (error.name !== 'AbortError') {
          // Fallback to clipboard
          await navigator.clipboard.writeText(
            `🏆 Check out @${creator.username} - #${rank} Top Creator on ToonlyReels with ${formatCount(creator.weeklyViews)} views this week!`
          );
          toast.success('Link copied to clipboard!');
        }
      }
    } else {
      // Fallback to clipboard
      await navigator.clipboard.writeText(
        `🏆 Check out @${creator.username} - #${rank} Top Creator on ToonlyReels with ${formatCount(creator.weeklyViews)} views this week!`
      );
      toast.success('Link copied to clipboard!');
    }
  };

  const GrowthIndicator = ({ value }: { value: number }) => {
    if (value === 0) return null;
    const isPositive = value > 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[9px] font-medium ${
        isPositive ? 'text-green-400' : 'text-red-400'
      }`}>
        {isPositive ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
        {isPositive ? '+' : ''}{value}%
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="p-4 border-b border-border">
        <div className="h-6 w-48 bg-muted rounded animate-pulse mb-3" />
        <div className="hidden lg:flex gap-3 overflow-x-auto pb-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex-shrink-0 w-32 h-48 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
        <div className="lg:hidden grid grid-cols-3 gap-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="aspect-square bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (topCreators.length === 0) return null;

  return (
    <>
      <div className="p-4 border-b border-border overflow-hidden">
        <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
          <Trophy className="h-5 w-5 text-fun-yellow" />
          This Week's Top Creatives
        </h2>
        
        {/* Horizontal scroll on laptop with slide-in animation */}
        <div className="hidden lg:flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
          {topCreators.map((creator, index) => (
            <div
              key={creator.id}
              className={`flex-shrink-0 w-32 bg-gradient-to-br from-primary/20 via-accent/20 to-fun-yellow/20 rounded-xl p-3 border border-border hover:border-primary/50 transition-all group ${
                animationTriggered 
                  ? 'opacity-100 translate-x-0' 
                  : index % 2 === 0 ? 'opacity-0 -translate-x-16' : 'opacity-0 translate-x-16'
              }`}
              style={{ 
                transitionProperty: 'opacity, transform',
                transitionDuration: '500ms',
                transitionDelay: `${index * 100}ms`,
                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              {/* Rank Badge */}
              <div className="flex justify-between items-start mb-2">
                <span className={`text-2xl font-bold ${
                  index === 0 ? 'text-fun-yellow' : index === 1 ? 'text-muted-foreground' : 'text-accent'
                }`}>
                  #{index + 1}
                </span>
                {index === 0 && <span className="text-lg">👑</span>}
              </div>

              {/* Avatar */}
              <div 
                className="cursor-pointer mb-2"
                onClick={() => navigate(`/profile?userId=${creator.id}`)}
              >
                <Avatar className="h-12 w-12 mx-auto ring-2 ring-primary/30 group-hover:ring-primary transition-all">
                  <AvatarImage src={creator.avatar_url || undefined} alt={creator.username} />
                  <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
                    {creator.username?.[0]?.toUpperCase() || 'C'}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Username */}
              <p 
                className="text-xs font-semibold text-center truncate cursor-pointer hover:text-primary transition-colors"
                onClick={() => navigate(`/profile?userId=${creator.id}`)}
              >
                @{creator.username}
                {creator.is_verified && (
                  <span className="ml-1 text-fun-blue">✓</span>
                )}
              </p>

              {/* Stats with growth indicators */}
              <div className="mt-2 text-[10px] text-muted-foreground space-y-0.5">
                <div className="flex items-center justify-center gap-1">
                  <Eye className="h-2.5 w-2.5" />
                  <span>{formatCount(creator.weeklyViews)}</span>
                  <GrowthIndicator value={creator.viewsGrowth} />
                </div>
                <div className="flex items-center justify-center gap-1">
                  <Heart className="h-2.5 w-2.5" />
                  <span>{formatCount(creator.weeklyLikes)}</span>
                  <GrowthIndicator value={creator.likesGrowth} />
                </div>
              </div>

              {/* Actions */}
              <div className="mt-2 flex gap-1 justify-center">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => handlePreview(creator, index + 1)}
                  title="Preview"
                >
                  <Play className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => handleDownload(creator, index + 1)}
                  title="Download"
                >
                  <Download className="h-3 w-3" />
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 w-6 p-0"
                  onClick={() => handleShare(creator, index + 1)}
                  title="Share"
                >
                  <Share2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        {/* Grid on mobile with slide-in animation */}
        <div className="lg:hidden grid grid-cols-3 gap-2">
          {topCreators.slice(0, 3).map((creator, index) => (
            <div
              key={creator.id}
              className={`bg-gradient-to-br from-primary/20 via-accent/20 to-fun-yellow/20 rounded-xl p-2 border border-border ${
                animationTriggered 
                  ? 'opacity-100 translate-y-0' 
                  : 'opacity-0 translate-y-8'
              }`}
              style={{ 
                transitionProperty: 'opacity, transform',
                transitionDuration: '500ms',
                transitionDelay: `${index * 150}ms`,
                transitionTimingFunction: 'cubic-bezier(0.34, 1.56, 0.64, 1)'
              }}
            >
              {/* Rank */}
              <div className="flex justify-between items-center mb-1">
                <span className={`text-lg font-bold ${
                  index === 0 ? 'text-fun-yellow' : index === 1 ? 'text-muted-foreground' : 'text-accent'
                }`}>
                  #{index + 1}
                </span>
                {index === 0 && <span className="text-sm">👑</span>}
              </div>

              {/* Avatar */}
              <div 
                className="cursor-pointer mb-1"
                onClick={() => navigate(`/profile?userId=${creator.id}`)}
              >
                <Avatar className="h-10 w-10 mx-auto ring-2 ring-primary/30">
                  <AvatarImage src={creator.avatar_url || undefined} alt={creator.username} />
                  <AvatarFallback className="text-sm font-bold bg-primary text-primary-foreground">
                    {creator.username?.[0]?.toUpperCase() || 'C'}
                  </AvatarFallback>
                </Avatar>
              </div>

              {/* Username */}
              <p 
                className="text-[10px] font-semibold text-center truncate cursor-pointer"
                onClick={() => navigate(`/profile?userId=${creator.id}`)}
              >
                @{creator.username}
              </p>

              {/* Stats with growth */}
              <div className="mt-1 text-[9px] text-muted-foreground space-y-0.5">
                <div className="flex items-center justify-center gap-1">
                  <Eye className="h-2 w-2" />
                  {formatCount(creator.weeklyViews)}
                  <GrowthIndicator value={creator.viewsGrowth} />
                </div>
                <div className="flex items-center justify-center gap-1">
                  <Heart className="h-2 w-2" />
                  {formatCount(creator.weeklyLikes)}
                </div>
              </div>

              {/* Actions */}
              <div className="mt-1 flex gap-1 justify-center">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1 text-[8px]"
                  onClick={() => handleDownload(creator, index + 1)}
                >
                  <Download className="h-2 w-2 mr-0.5" />
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-5 px-1 text-[8px]"
                  onClick={() => handleShare(creator, index + 1)}
                >
                  <Share2 className="h-2 w-2" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Preview Modal */}
      {previewImage && previewCreator && (
        <div 
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => { setPreviewImage(null); setPreviewCreator(null); }}
        >
          <div className="relative max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <img 
              src={previewImage} 
              alt="Creator Card Preview" 
              className="w-full rounded-xl shadow-2xl"
            />
            <div className="mt-4 flex gap-2 justify-center flex-wrap">
              <Button
                onClick={() => {
                  const link = document.createElement('a');
                  link.download = `toonlyreels-top-creator-${previewCreator.username}.png`;
                  link.href = previewImage;
                  link.click();
                  toast.success('Image downloaded!');
                }}
              >
                <Download className="h-4 w-4 mr-2" />
                Download
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleShare(previewCreator, topCreators.indexOf(previewCreator) + 1)}
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share
              </Button>
              <Button variant="outline" onClick={() => { setPreviewImage(null); setPreviewCreator(null); }}>
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TopCreativesSection;
