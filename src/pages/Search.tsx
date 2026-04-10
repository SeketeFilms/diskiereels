import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search as SearchIcon, TrendingUp, Hash } from 'lucide-react';
import ResponsiveLayout from '@/components/ResponsiveLayout';
import VideoPreviewCard from '@/components/VideoPreviewCard';
import TopCreativesSection from '@/components/TopCreativesSection';
import ExploreReelViewer from '@/components/ExploreReelViewer';

const CATEGORIES = [
  { id: 'all', label: 'All', emoji: '🎬' },
  { id: 'comedy', label: 'Comedy', emoji: '😂' },
  { id: 'adventure', label: 'Adventure', emoji: '🚀' },
  { id: 'learning', label: 'Learning', emoji: '📚' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'animals', label: 'Animals', emoji: '🐾' },
  { id: 'superheroes', label: 'Heroes', emoji: '🦸' },
  { id: 'fairytales', label: 'Fairytales', emoji: '🏰' },
];

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

interface CreatorResult {
  id: string;
  username: string;
  avatar_url: string | null;
  user_type: 'viewer' | 'creative';
  is_verified: boolean;
  follower_count: number;
}

const normalizeSearch = (raw: string) => raw.trim().replace(/^@/, '');

const Search = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [videos, setVideos] = useState<Video[]>([]);
  const [trendingVideos, setTrendingVideos] = useState<Video[]>([]);
  const [trendingHashtags, setTrendingHashtags] = useState<{ tag: string; count: number }[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [creatorResults, setCreatorResults] = useState<CreatorResult[]>([]);
  const [showCreatorResults, setShowCreatorResults] = useState(false);
  const [currentUserType, setCurrentUserType] = useState<'viewer' | 'creative' | null>(null);

  // Reel viewer state
  const [reelViewer, setReelViewer] = useState<{
    videos: Video[];
    startIndex: number;
    title: string;
  } | null>(null);

  // Fetch current user type
  useEffect(() => {
    const fetchCurrentUserType = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('user_type')
          .eq('id', user.id)
          .maybeSingle();
        if (profile) {
          setCurrentUserType(profile.user_type as 'viewer' | 'creative');
        }
      }
    };
    fetchCurrentUserType();
  }, []);

  // Track if we need to search after setting query from URL
  const [pendingTagSearch, setPendingTagSearch] = useState<string | null>(null);

  // Handle tag from URL parameter (when clicking hashtag from video player)
  useEffect(() => {
    const tagFromUrl = searchParams.get('tag');
    if (tagFromUrl) {
      setSearchQuery(`#${tagFromUrl}`);
      setPendingTagSearch(tagFromUrl);
      // Clear the URL param to avoid re-triggering
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    fetchVideos();
    fetchTrendingVideos();
    fetchTrendingHashtags();
  }, [selectedCategory]);

  useEffect(() => {
    const term = normalizeSearch(searchQuery);

    // Only show creator suggestions for normal text searches (not hashtags)
    if (!term || term.startsWith('#')) {
      setCreatorResults([]);
      setShowCreatorResults(false);
      return;
    }

    const t = window.setTimeout(async () => {
      // Both Creatives and Viewers can only search Creatives
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, user_type, is_verified')
        .eq('user_type', 'creative')
        .ilike('username', `%${term}%`)
        .limit(6);

      if (!profiles || profiles.length === 0) {
        setCreatorResults([]);
        setShowCreatorResults(true);
        return;
      }

      // Get follower counts for each creator
      const creatorIds = profiles.map(p => p.id);
      const { data: followCounts } = await supabase
        .from('follows')
        .select('following_id')
        .in('following_id', creatorIds);

      // Count followers per creator
      const followerMap: Record<string, number> = {};
      (followCounts || []).forEach(f => {
        followerMap[f.following_id] = (followerMap[f.following_id] || 0) + 1;
      });

      const resultsWithCounts: CreatorResult[] = profiles.map(p => ({
        ...p,
        user_type: p.user_type as 'viewer' | 'creative',
        is_verified: p.is_verified || false,
        follower_count: followerMap[p.id] || 0
      }));

      // Sort by follower count (most popular first)
      resultsWithCounts.sort((a, b) => b.follower_count - a.follower_count);

      setCreatorResults(resultsWithCounts);
      setShowCreatorResults(true);
    }, 200);

    return () => window.clearTimeout(t);
  }, [searchQuery]);

  const fetchTrendingVideos = async () => {
    const { data } = await supabase
      .from('videos')
      .select(`
        *,
        profiles(username, avatar_url, is_verified)
      `)
      .order('views_count', { ascending: false })
      .limit(6);
    setTrendingVideos(data || []);
  };

  const fetchTrendingHashtags = async () => {
    // Fetch recent videos with tags to extract popular hashtags
    const { data: recentVideos } = await supabase
      .from('videos')
      .select('tags, views_count')
      .not('tags', 'is', null)
      .order('created_at', { ascending: false })
      .limit(100);

    if (!recentVideos) {
      setTrendingHashtags([]);
      return;
    }

    // Count tag occurrences weighted by views
    const tagCounts: Record<string, number> = {};
    recentVideos.forEach((video) => {
      if (video.tags) {
        video.tags.forEach((tag: string) => {
          const normalizedTag = tag.toLowerCase();
          // Weight by views (minimum 1) to get truly popular tags
          tagCounts[normalizedTag] = (tagCounts[normalizedTag] || 0) + 1 + Math.floor((video.views_count || 0) / 100);
        });
      }
    });

    // Sort by count and take top 10
    const sortedTags = Object.entries(tagCounts)
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setTrendingHashtags(sortedTags);
  };

  const fetchVideos = async () => {
    setIsLoading(true);
    let query = supabase
      .from('videos')
      .select(`
        *,
        profiles(username, avatar_url, is_verified)
      `)
      .order('created_at', { ascending: false });

    // Filter by category/tag if not "all"
    if (selectedCategory !== 'all') {
      query = query.contains('tags', [selectedCategory]);
    }

    const { data } = await query;
    setVideos(data || []);
    setIsLoading(false);
  };

  // Search by hashtag (called when navigating from video player)
  const handleSearchByTag = useCallback(async (tag: string) => {
    const searchTerm = tag.toLowerCase().replace('#', '');
    if (!searchTerm) return;

    setIsLoading(true);
    setHasSearched(true);

    const { data: tagResults } = await supabase
      .from('videos')
      .select(`
        *,
        profiles(username, avatar_url, is_verified)
      `)
      .contains('tags', [searchTerm])
      .order('created_at', { ascending: false });

    setVideos(tagResults || []);
    setIsLoading(false);
    setPendingTagSearch(null);
  }, []);

  // Trigger search when we have a pending tag from URL
  useEffect(() => {
    if (pendingTagSearch) {
      handleSearchByTag(pendingTagSearch);
    }
  }, [pendingTagSearch, handleSearchByTag]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      fetchVideos();
      return;
    }

    setIsLoading(true);
    setHasSearched(true);

    // Search by title, description, creator username, or tags (including hashtags)
    const searchTerm = normalizeSearch(searchQuery).toLowerCase().replace('#', '');

    const { data } = await supabase
      .from('videos')
      .select(`
        *,
        profiles(username, avatar_url, is_verified)
      `)
      .or(
        `title.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,profiles.username.ilike.%${searchTerm}%`
      )
      .order('created_at', { ascending: false });

    // Also filter by tags if search includes hashtag
    let results = data || [];
    if (searchQuery.startsWith('#')) {
      const { data: tagResults } = await supabase
        .from('videos')
        .select(`
          *,
          profiles(username, avatar_url, is_verified)
        `)
        .contains('tags', [searchTerm])
        .order('created_at', { ascending: false });
      
      // Merge results and remove duplicates
      const allResults = [...results, ...(tagResults || [])];
      results = allResults.filter((v, i, arr) => arr.findIndex(x => x.id === v.id) === i);
    }

    setVideos(results);
    setIsLoading(false);
  };

  const handleVideoClick = (videoId: string, sectionVideos: Video[], sectionTitle: string) => {
    const index = sectionVideos.findIndex(v => v.id === videoId);
    setReelViewer({
      videos: sectionVideos,
      startIndex: index >= 0 ? index : 0,
      title: sectionTitle,
    });
  };

  const formatCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <ResponsiveLayout>
    <div className="min-h-screen bg-background pb-24 md:pb-4">
      {/* Header with Logo */}
      <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
        <div className="p-4">
          
          
          {/* Search Bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search creators, toonz, #hashtags..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setHasSearched(false);
                }}
                onFocus={() => setShowCreatorResults(true)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-10 bg-muted border-0 rounded-full"
              />

              {showCreatorResults && creatorResults.length > 0 && !searchQuery.trim().startsWith('#') && (
                <div className="absolute left-0 right-0 mt-2 rounded-xl border border-border bg-card shadow-lg overflow-hidden z-50">
                  {creatorResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        navigate(`/profile?userId=${c.id}`);
                        setShowCreatorResults(false);
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 text-left hover:bg-accent/50 transition-colors"
                    >
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={c.avatar_url || undefined} alt={`${c.username} profile picture`} />
                        <AvatarFallback className="text-[10px] font-bold">
                          {c.username?.[0]?.toUpperCase() || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-foreground truncate">{c.username}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {c.follower_count} {c.follower_count === 1 ? 'follower' : 'followers'}
                        </p>
                      </div>
                      {c.is_verified && c.username === 'ToonlyReelsOff' ? (
                        <span className="text-yellow-400 text-base drop-shadow-[0_0_1px_rgba(0,0,0,1)] [text-shadow:_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000,_1px_1px_0_#000]">
                          ⭐
                        </span>
                      ) : c.is_verified ? (
                        <span className="text-[10px] bg-yellow-400 text-black px-2 py-0.5 rounded-full font-medium shrink-0 flex items-center gap-1">
                          <span>✓</span> Verified
                        </span>
                      ) : (
                        <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium shrink-0">
                          Creative
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <Button 
              onClick={handleSearch}
              className="rounded-full px-6"
            >
              Search
            </Button>
          </div>
        </div>

        {/* Category Pills */}
        <div className="px-4 pb-3 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => {
                  setSelectedCategory(cat.id);
                  setSearchQuery('');
                  setHasSearched(false);
                }}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-full whitespace-nowrap transition-all text-sm font-medium ${
                  selectedCategory === cat.id
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Trending Section */}
      {!hasSearched && selectedCategory === 'all' && trendingVideos.length > 0 && (
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            🔥 Trending Now
          </h2>
          <div className="hidden lg:flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {trendingVideos.slice(0, 6).map((video, i) => (
              <div key={video.id} className="flex-shrink-0 w-32">
                <VideoPreviewCard
                  title={video.title}
                  thumbnailUrl={video.thumbnail_url}
                  videoUrl={video.video_url}
                  viewsCount={video.views_count}
                  likesCount={video.likes_count}
                  onClick={() => handleVideoClick(video.id, trendingVideos.slice(0, 6), '🔥 Trending Now')}
                  formatCount={formatCount}
                  compact
                  showStatsTopRight
                />
              </div>
            ))}
          </div>
          <div className="lg:hidden grid grid-cols-3 gap-2">
            {trendingVideos.slice(0, 3).map((video) => (
              <VideoPreviewCard
                key={video.id}
                title={video.title}
                thumbnailUrl={video.thumbnail_url}
                videoUrl={video.video_url}
                viewsCount={video.views_count}
                likesCount={video.likes_count}
                onClick={() => handleVideoClick(video.id, trendingVideos.slice(0, 6), '🔥 Trending Now')}
                formatCount={formatCount}
              />
            ))}
          </div>
        </div>
      )}

      {/* Trending Hashtags Section */}
      {!hasSearched && selectedCategory === 'all' && trendingHashtags.length > 0 && (() => {
        const hashtagVideos = trendingVideos.filter(v => v.tags && v.tags.length > 0);
        return (
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            Trending Hashtags
          </h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {trendingHashtags.map((item, index) => (
              <button
                key={item.tag}
                onClick={() => {
                  setSearchQuery(`#${item.tag}`);
                  handleSearchByTag(item.tag);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all text-sm font-medium cursor-pointer hover:scale-105 ${
                  index === 0 
                    ? 'bg-gradient-to-r from-primary to-primary/80 text-primary-foreground' 
                    : index < 3 
                      ? 'bg-primary/20 text-primary hover:bg-primary/30' 
                      : 'bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                }`}
              >
                <Hash className="h-3 w-3" />
                <span>{item.tag}</span>
              </button>
            ))}
          </div>
          <div className="hidden lg:flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {hashtagVideos.slice(0, 8).map((video) => (
              <div key={video.id} className="flex-shrink-0 w-32">
                <VideoPreviewCard
                  title={video.title}
                  thumbnailUrl={video.thumbnail_url}
                  videoUrl={video.video_url}
                  viewsCount={video.views_count}
                  likesCount={video.likes_count}
                  onClick={() => handleVideoClick(video.id, hashtagVideos.slice(0, 8), 'Trending Hashtags')}
                  formatCount={formatCount}
                  compact
                  showStatsTopRight
                />
              </div>
            ))}
          </div>
          <div className="lg:hidden grid grid-cols-3 gap-2">
            {hashtagVideos.slice(0, 3).map((video) => (
              <VideoPreviewCard
                key={video.id}
                title={video.title}
                thumbnailUrl={video.thumbnail_url}
                videoUrl={video.video_url}
                viewsCount={video.views_count}
                likesCount={video.likes_count}
                onClick={() => handleVideoClick(video.id, hashtagVideos.slice(0, 8), 'Trending Hashtags')}
                formatCount={formatCount}
                showStatsTopRight
              />
            ))}
          </div>
        </div>
        );
      })()}

      {/* Popular Animations */}
      {!hasSearched && selectedCategory === 'all' && trendingVideos.length > 0 && (
        <div className="p-4 border-b border-border">
          <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
            🎬 Popular Animations
          </h2>
          <div className="hidden lg:flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {trendingVideos.slice(0, 8).map((video) => (
              <div key={video.id} className="flex-shrink-0 w-32">
                <VideoPreviewCard
                  title={video.title}
                  thumbnailUrl={video.thumbnail_url}
                  videoUrl={video.video_url}
                  viewsCount={video.views_count}
                  likesCount={video.likes_count}
                  onClick={() => handleVideoClick(video.id, trendingVideos.slice(0, 8), '🎬 Popular Animations')}
                  formatCount={formatCount}
                  compact
                  showStatsTopRight
                />
              </div>
            ))}
          </div>
          <div className="lg:hidden grid grid-cols-3 gap-2">
            {trendingVideos.slice(0, 3).map((video) => (
              <VideoPreviewCard
                key={video.id}
                title={video.title}
                thumbnailUrl={video.thumbnail_url}
                videoUrl={video.video_url}
                viewsCount={video.views_count}
                likesCount={video.likes_count}
                onClick={() => handleVideoClick(video.id, trendingVideos.slice(0, 8), '🎬 Popular Animations')}
                formatCount={formatCount}
                showStatsTopRight
              />
            ))}
          </div>
        </div>
      )}

      {/* This Week's Top Creatives Section */}
      {!hasSearched && selectedCategory === 'all' && (
        <TopCreativesSection formatCount={formatCount} />
      )}

      {/* Results */}
      <div className="p-4">
        {isLoading ? (
          <div className="hidden lg:flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex-shrink-0 w-32 aspect-[9/16] bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        ) : videos.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">
              {hasSearched ? 'No toonz found for your search' : 'No toonz in this category yet'}
            </p>
          </div>
        ) : (
          <>
            <div className="hidden lg:flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
              {videos.map((video) => (
                <div key={video.id} className="flex-shrink-0 w-32 relative">
                  <VideoPreviewCard
                    title={video.title}
                    thumbnailUrl={video.thumbnail_url}
                    videoUrl={video.video_url}
                    viewsCount={video.views_count}
                    likesCount={video.likes_count}
                    onClick={() => handleVideoClick(video.id, videos, hasSearched ? 'Search Results' : selectedCategory === 'all' ? 'All Toonz' : selectedCategory)}
                    formatCount={formatCount}
                    compact
                    showStatsTopRight
                  />
                </div>
              ))}
            </div>
            <div className="lg:hidden grid grid-cols-3 gap-2">
              {videos.map((video) => (
                <div key={video.id} className="relative">
                  <VideoPreviewCard
                    title={video.title}
                    thumbnailUrl={video.thumbnail_url}
                    videoUrl={video.video_url}
                    viewsCount={video.views_count}
                    likesCount={video.likes_count}
                    onClick={() => handleVideoClick(video.id, videos, hasSearched ? 'Search Results' : selectedCategory === 'all' ? 'All Toonz' : selectedCategory)}
                    formatCount={formatCount}
                    showStatsTopRight
                  />
                </div>
              ))}
            </div>
          </>
        )}
        {isLoading && (
          <div className="lg:hidden grid grid-cols-3 gap-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="aspect-[9/16] bg-muted rounded-xl animate-pulse" />
            ))}
          </div>
        )}
      </div>

    </div>

    {/* Explore Reel Viewer */}
    {reelViewer && (
      <ExploreReelViewer
        videos={reelViewer.videos}
        startIndex={reelViewer.startIndex}
        sectionTitle={reelViewer.title}
        onClose={() => setReelViewer(null)}
      />
    )}

    </ResponsiveLayout>
  );
};

export default Search;
