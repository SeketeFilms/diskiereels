import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Download, Flag, Trash2, Volume2, VolumeX, Bookmark, BookmarkCheck, Settings, Repeat, Ban, BadgeCheck, Subtitles, Star } from 'lucide-react';
import { toast } from 'sonner';
import LikeAnimation from '@/components/LikeAnimation';
import { useNavigate } from 'react-router-dom';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import DownloadQualityDialog from '@/components/DownloadQualityDialog';
import DownloadProgressOverlay from '@/components/DownloadProgressOverlay';
import { useHapticFeedback } from '@/hooks/useHapticFeedback';
import { useFullscreen } from '@/hooks/useFullscreen';
import { useIsMobile } from '@/hooks/use-mobile';
import { useSoundEffects } from '@/hooks/useSoundEffects';
import { addWatermarkToVideo, WatermarkController } from '@/lib/videoWatermark';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import SendStarsDialog from '@/components/SendStarsDialog';

interface SubtitleSegment {
  id: number;
  text: string;
  start: number;
  end: number;
}

interface VideoPlayerProps {
  video: {
    id: string;
    video_url: string;
    title: string;
    description: string;
    creator_id: string;
    likes_count: number;
    views_count: number;
    tags?: string[] | null;
    subtitles?: SubtitleSegment[] | null;
    profiles: {
      username: string;
      avatar_url: string;
      is_verified: boolean;
    };
  };
  currentUserId: string;
  isPremium: boolean;
  isActive: boolean;
  onCommentsClick: () => void;
  onDelete?: () => void;
  onPositiveAction?: () => void;
}

type PlaybackQuality = 'auto' | 'high' | 'medium';

interface CachedPlaybackSettings {
  autoplay: boolean;
  videoQuality: PlaybackQuality;
  subtitlesEnabled: boolean;
  subtitlesSize: 'small' | 'medium' | 'large';
  fetchedAt: number;
}

interface CachedVideoEngagement {
  commentsCount: number;
  savesCount: number;
  fetchedAt: number;
}

interface CachedViewerVideoState {
  liked: boolean;
  saved: boolean;
  following: boolean;
  blocked: boolean;
  fetchedAt: number;
}

const playbackSettingsCache = new Map<string, CachedPlaybackSettings>();
const videoEngagementCache = new Map<string, CachedVideoEngagement>();
const viewerVideoStateCache = new Map<string, CachedViewerVideoState>();
const PLAYBACK_SETTINGS_TTL = 5 * 60 * 1000;
const VIDEO_ENGAGEMENT_TTL = 60 * 1000;
const VIEWER_VIDEO_STATE_TTL = 60 * 1000;

const getPlaybackNetworkProfile = () => {
  if (typeof navigator === 'undefined') {
    return { saveData: false, isSlowConnection: false };
  }

  const connection = (navigator as Navigator & {
    connection?: {
      saveData?: boolean;
      effectiveType?: string;
    };
  }).connection;

  const effectiveType = connection?.effectiveType ?? '';

  return {
    saveData: Boolean(connection?.saveData),
    isSlowConnection: effectiveType.includes('2g') || effectiveType === '3g',
  };
};

const normalizePlaybackQuality = (value?: string | null): PlaybackQuality => {
  if (value === 'auto' || value === 'high' || value === 'medium') {
    return value;
  }

  return 'auto';
};

const VideoPlayer = ({ video, currentUserId, isPremium, isActive, onCommentsClick, onDelete, onPositiveAction }: VideoPlayerProps) => {
  const navigate = useNavigate();
  const { triggerLikeHaptic, triggerHaptic } = useHapticFeedback();
  const { playLikeSound, playTapSound, playSuccessSound } = useSoundEffects();
  const { isFullscreen, toggleFullscreen } = useFullscreen();
  const isMobile = useIsMobile();
  const [isExpanded, setIsExpanded] = useState(false);
  const [trendingTags, setTrendingTags] = useState<string[]>([]);
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(video.likes_count);
  const [commentsCount, setCommentsCount] = useState(0);
  const [savesCount, setSavesCount] = useState(0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [likeAnimations, setLikeAnimations] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [isMuted, setIsMuted] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [bufferedPercent, setBufferedPercent] = useState(0);
  const isBufferingRef = useRef(false);
  const currentTimeRef = useRef(0);
  const bufferedPercentRef = useRef(0);
  const [autoplayEnabled, setAutoplayEnabled] = useState(true);
  const [videoQuality, setVideoQuality] = useState<PlaybackQuality>('auto');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showSettingsMenu, setShowSettingsMenu] = useState(false);
  const [isLooping, setIsLooping] = useState(true);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [downloadStage, setDownloadStage] = useState('');
  const [isDownloading, setIsDownloading] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(true);
  const [subtitlesSize, setSubtitlesSize] = useState<'small' | 'medium' | 'large'>('medium');
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [subtitlePosition, setSubtitlePosition] = useState({ x: 0, y: 180 });
  const [isDraggingSubtitle, setIsDraggingSubtitle] = useState(false);
  const [showStarsDialog, setShowStarsDialog] = useState(false);
  const subtitleDragStart = useRef<{ x: number; y: number; posX: number; posY: number } | null>(null);
  
  const lastTapRef = useRef<number>(0);
  const animationIdRef = useRef<number>(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const watchStartTimeRef = useRef<number>(Date.now());
  const analyticsTrackedRef = useRef<boolean>(false);
  const hasTrackedViewRef = useRef<boolean>(false);
  const playAttemptRef = useRef<number>(0);
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const downloadControllerRef = useRef<WatermarkController | null>(null);
  const subtitleRef = useRef<HTMLDivElement>(null);
  const stallCountRef = useRef<number>(0);
  const audioPreferenceRef = useRef<'auto' | 'muted' | 'unmuted'>('auto');
  const deferredDataFetchTimerRef = useRef<number | null>(null);
  const stallRecoveryTimerRef = useRef<number | null>(null);
  const lastRecoveryAtRef = useRef<number>(0);

  const isOwnVideo = currentUserId === video.creator_id;
  const networkProfile = getPlaybackNetworkProfile();
  const isTouchPlaybackDevice =
    isMobile ||
    (typeof window !== 'undefined' && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0 && window.innerWidth <= 1024);
  const effectiveVideoQuality: Exclude<PlaybackQuality, 'auto'> =
    videoQuality === 'medium' ||
    (videoQuality === 'auto' && (networkProfile.saveData || (isTouchPlaybackDevice && networkProfile.isSlowConnection)))
      ? 'medium'
      : 'high';
  const shouldStartMuted =
    audioPreferenceRef.current === 'muted' ||
    (audioPreferenceRef.current !== 'unmuted' &&
      (isMobile || effectiveVideoQuality === 'medium' || networkProfile.saveData || networkProfile.isSlowConnection));
  const activeVideoPreload = isActive
    ? effectiveVideoQuality === 'high' && !networkProfile.saveData && !isTouchPlaybackDevice
      ? 'auto'
      : 'metadata'
    : 'none';

  // Initial data fetch - only fetch when active, batch all queries in parallel
  useEffect(() => {
    if (!isActive || !currentUserId) return;

    fetchPlaybackSettings();

    const viewerStateKey = `${currentUserId}:${video.id}:${video.creator_id}`;
    const cachedViewerState = viewerVideoStateCache.get(viewerStateKey);
    if (cachedViewerState && Date.now() - cachedViewerState.fetchedAt < VIEWER_VIDEO_STATE_TTL) {
      setLiked(cachedViewerState.liked);
      setIsSaved(cachedViewerState.saved);
      setIsFollowing(cachedViewerState.following);
      setIsBlocked(cachedViewerState.blocked);
    }

    const cachedEngagement = videoEngagementCache.get(video.id);
    if (cachedEngagement && Date.now() - cachedEngagement.fetchedAt < VIDEO_ENGAGEMENT_TTL) {
      setCommentsCount(cachedEngagement.commentsCount);
      setSavesCount(cachedEngagement.savesCount);
    }

    if (deferredDataFetchTimerRef.current) {
      window.clearTimeout(deferredDataFetchTimerRef.current);
    }

    deferredDataFetchTimerRef.current = window.setTimeout(() => {
      const viewerStateNeedsRefresh = !cachedViewerState || Date.now() - cachedViewerState.fetchedAt >= VIEWER_VIDEO_STATE_TTL;
      const engagementNeedsRefresh = !cachedEngagement || Date.now() - cachedEngagement.fetchedAt >= VIDEO_ENGAGEMENT_TTL;

      const tasks: Promise<unknown>[] = [];

      if (viewerStateNeedsRefresh) {
        tasks.push(
          Promise.allSettled([checkIfFollowing(), checkIfLiked(), checkIfSaved(), checkIfBlocked()])
        );
      }

      if (engagementNeedsRefresh) {
        tasks.push(Promise.allSettled([fetchCommentsCount(), fetchSavesCount()]));
      }

      if (tasks.length > 0) {
        Promise.allSettled(tasks);
      }
    }, isTouchPlaybackDevice ? 400 : 0);

    return () => {
      if (deferredDataFetchTimerRef.current) {
        window.clearTimeout(deferredDataFetchTimerRef.current);
        deferredDataFetchTimerRef.current = null;
      }
    };
  }, [video.id, video.creator_id, currentUserId, isActive, isTouchPlaybackDevice]);

  // Fetch trending tags only once and cache them
  useEffect(() => {
    // Use sessionStorage cache to avoid refetching on every video
    const cached = sessionStorage.getItem('toonreels_trending_tags');
    if (cached) {
      try {
        const { tags, timestamp } = JSON.parse(cached);
        // Cache valid for 5 minutes
        if (Date.now() - timestamp < 5 * 60 * 1000) {
          setTrendingTags(tags);
          return;
        }
      } catch {}
    }
    
    fetchTrendingTags();
  }, []);

  // Fetch trending tags to show fire emoji - moved outside of main useEffect
  const fetchTrendingTags = async () => {
    const { data: recentVideos } = await supabase
      .from('videos')
      .select('tags, views_count')
      .not('tags', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50); // Reduced from 100 to 50

    if (!recentVideos) return;

    const tagCounts: Record<string, number> = {};
    recentVideos.forEach((vid) => {
      if (vid.tags && Array.isArray(vid.tags)) {
        vid.tags.forEach((tag: string) => {
          tagCounts[tag] = (tagCounts[tag] || 0) + (vid.views_count || 1);
        });
      }
    });

    const topTags = Object.entries(tagCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag]) => tag);

    setTrendingTags(topTags);
    
    // Cache the result
    sessionStorage.setItem('toonreels_trending_tags', JSON.stringify({
      tags: topTags,
      timestamp: Date.now()
    }));
  };

  const fetchPlaybackSettings = async () => {
    if (!currentUserId) return;

    const cached = playbackSettingsCache.get(currentUserId);
    if (cached && Date.now() - cached.fetchedAt < PLAYBACK_SETTINGS_TTL) {
      setAutoplayEnabled(cached.autoplay);
      setVideoQuality(cached.videoQuality);
      setSubtitlesEnabled(cached.subtitlesEnabled);
      setSubtitlesSize(cached.subtitlesSize);
      return;
    }

    const { data } = await supabase
      .from('playback_settings')
      .select('autoplay, video_quality, subtitles_enabled, subtitles_size')
      .eq('user_id', currentUserId)
      .maybeSingle();

    const resolvedSettings: CachedPlaybackSettings = {
      autoplay: data?.autoplay ?? true,
      videoQuality: normalizePlaybackQuality(data?.video_quality),
      subtitlesEnabled: data?.subtitles_enabled ?? true,
      subtitlesSize: (data?.subtitles_size as 'small' | 'medium' | 'large') || 'medium',
      fetchedAt: Date.now(),
    };

    playbackSettingsCache.set(currentUserId, resolvedSettings);
    setAutoplayEnabled(resolvedSettings.autoplay);
    setVideoQuality(resolvedSettings.videoQuality);
    setSubtitlesEnabled(resolvedSettings.subtitlesEnabled);
    setSubtitlesSize(resolvedSettings.subtitlesSize);
  };

  const fetchCommentsCount = async () => {
    const { count } = await supabase
      .from('comments')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', video.id);

    const nextCommentsCount = count || 0;
    const existingCache = videoEngagementCache.get(video.id);
    videoEngagementCache.set(video.id, {
      commentsCount: nextCommentsCount,
      savesCount: existingCache?.savesCount ?? savesCount,
      fetchedAt: Date.now(),
    });
    setCommentsCount(nextCommentsCount);
  };

  const fetchSavesCount = async () => {
    const { count } = await supabase
      .from('saved_videos')
      .select('*', { count: 'exact', head: true })
      .eq('video_id', video.id);

    const nextSavesCount = count || 0;
    const existingCache = videoEngagementCache.get(video.id);
    videoEngagementCache.set(video.id, {
      commentsCount: existingCache?.commentsCount ?? commentsCount,
      savesCount: nextSavesCount,
      fetchedAt: Date.now(),
    });
    setSavesCount(nextSavesCount);
  };

  // Handle active state - play/pause based on visibility with better mobile support
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    videoEl.playbackRate = playbackSpeed;
    videoEl.loop = isLooping;
    videoEl.preload = activeVideoPreload;

    if (!isActive) {
      videoEl.pause();
      videoEl.muted = true;
      setIsMuted(true);
      setIsPlaying(false);
      setIsBuffering(false);
      if (stallRecoveryTimerRef.current) {
        window.clearTimeout(stallRecoveryTimerRef.current);
        stallRecoveryTimerRef.current = null;
      }
      if (!analyticsTrackedRef.current && hasTrackedViewRef.current) {
        trackVideoAnalytics(false);
      }

      if (isTouchPlaybackDevice) {
        videoEl.removeAttribute('src');
        videoEl.load();
      }

      return;
    }

    if (!autoplayEnabled) {
      if (videoEl.getAttribute('src') !== video.video_url) {
        videoEl.src = video.video_url;
      }
      videoEl.pause();
      videoEl.muted = shouldStartMuted;
      setIsMuted(shouldStartMuted);
      setIsPlaying(false);
      setIsBuffering(false);
      return;
    }

    let isCancelled = false;
    
    const attemptPlay = async () => {
      if (isCancelled) return;
      playAttemptRef.current++;
      
      try {
        if (videoEl.getAttribute('src') !== video.video_url && video.video_url) {
          videoEl.src = video.video_url;
          videoEl.load();
        }
        
        if (videoEl.readyState < 2) {
          await new Promise<void>((resolve) => {
            const timeoutId = window.setTimeout(() => {
              videoEl.removeEventListener('canplay', onReady);
              videoEl.removeEventListener('loadeddata', onReady);
              resolve();
            }, effectiveVideoQuality === 'high' ? 900 : 1400);
            
            const onReady = () => {
              window.clearTimeout(timeoutId);
              videoEl.removeEventListener('canplay', onReady);
              videoEl.removeEventListener('loadeddata', onReady);
              resolve();
            };
            
            videoEl.addEventListener('canplay', onReady);
            videoEl.addEventListener('loadeddata', onReady);
          });
        }
        
        if (isCancelled) return;
        
        if (videoEl.duration && videoEl.currentTime >= videoEl.duration - 0.5) {
          videoEl.currentTime = 0;
        }
        
        videoEl.muted = shouldStartMuted;
        setIsMuted(shouldStartMuted);
        
        const playPromise = videoEl.play();
        if (playPromise !== undefined) {
          await playPromise;
        }
        
        if (isCancelled) return;
        setIsPlaying(true);
        setIsBuffering(false);
        
        if (!hasTrackedViewRef.current) {
          incrementViewCount();
          hasTrackedViewRef.current = true;
          watchStartTimeRef.current = Date.now();
          analyticsTrackedRef.current = false;
        }
      } catch (playError) {
        console.log('Autoplay failed, waiting for user interaction', playError);
        setIsPlaying(false);
        setIsBuffering(false);
      }
    };

    attemptPlay();
    
    return () => {
      isCancelled = true;
    };
  }, [isActive, video.video_url, autoplayEnabled, shouldStartMuted, effectiveVideoQuality, playbackSpeed, isLooping, activeVideoPreload, isTouchPlaybackDevice]);

  // Handle video events for better mobile playback
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handleWaiting = () => {
      if (!isBufferingRef.current) {
        isBufferingRef.current = true;
        setIsBuffering(true);
      }
    };
    const handlePlaying = () => {
      if (isBufferingRef.current) {
        isBufferingRef.current = false;
        setIsBuffering(false);
      }
      stallCountRef.current = 0;
    };
    const handleCanPlay = () => {
      if (isBufferingRef.current) {
        isBufferingRef.current = false;
        setIsBuffering(false);
      }
    };
    const reloadVideoFromCurrentPosition = () => {
      const now = Date.now();
      if (now - lastRecoveryAtRef.current < 2500) return;
      lastRecoveryAtRef.current = now;

      const resumeAt = Math.max(0, videoEl.currentTime || 0);
      const restorePlayback = () => {
        videoEl.removeEventListener('loadedmetadata', restorePlayback);
        if (resumeAt > 0 && Number.isFinite(videoEl.duration)) {
          videoEl.currentTime = Math.min(resumeAt, Math.max(0, videoEl.duration - 0.1));
        }
        videoEl.play().catch(() => {});
      };

      videoEl.addEventListener('loadedmetadata', restorePlayback, { once: true });
      videoEl.load();
    };
    
    const handleStalled = () => {
      if (!isActive) return;
      stallCountRef.current++;
      
      const count = stallCountRef.current;
      const delay = Math.min(600 * count, 2200);
      
      if (stallRecoveryTimerRef.current) {
        window.clearTimeout(stallRecoveryTimerRef.current);
      }

      stallRecoveryTimerRef.current = window.setTimeout(() => {
        if (!videoEl || !isActive) return;

        if (count <= 2) {
          if (videoEl.readyState >= 2) {
            videoEl.play().catch(() => {});
          }
          return;
        }

        if (count <= 4 && Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
          videoEl.currentTime = Math.min(videoEl.currentTime + 0.05, Math.max(videoEl.duration - 0.1, 0));
          videoEl.play().catch(() => {});
          return;
        }

        reloadVideoFromCurrentPosition();
      }, delay);
    };
    
    const handleError = () => {
      if (!isActive) return;
      if (stallCountRef.current > 4) return;
      stallCountRef.current++;
      reloadVideoFromCurrentPosition();
    };

    // Heavily throttled timeupdate - only setState when value visibly changes
    let lastTimeUpdate = 0;
    let rafId: number | null = null;
    const handleTimeUpdate = () => {
      const now = Date.now();
      if (now - lastTimeUpdate < 500) return; // Max 2 updates/sec on mobile
      lastTimeUpdate = now;
      
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const time = videoEl.currentTime;
        // Only re-render if time changed by >0.4s (visible on progress bar)
        if (Math.abs(time - currentTimeRef.current) > 0.4) {
          currentTimeRef.current = time;
          setCurrentTime(time);
        }
        
        if (video.subtitles && subtitlesEnabled) {
          const activeSubtitle = video.subtitles.find(
            (sub) => time >= sub.start && time <= sub.end
          );
          const newText = activeSubtitle?.text || '';
          setCurrentSubtitle(prev => prev === newText ? prev : newText);
        }
      });
    };
    const handleLoadedMetadata = () => setDuration(videoEl.duration);
    const handleDurationChange = () => setDuration(videoEl.duration);
    // Throttle progress events - only update if buffered changed significantly
    const handleProgress = () => {
      if (videoEl.buffered.length > 0 && videoEl.duration > 0) {
        const bufferedEnd = videoEl.buffered.end(videoEl.buffered.length - 1);
        const newPercent = (bufferedEnd / videoEl.duration) * 100;
        if (Math.abs(newPercent - bufferedPercentRef.current) > 3) {
          bufferedPercentRef.current = newPercent;
          setBufferedPercent(newPercent);
        }
      }
    };

    videoEl.addEventListener('waiting', handleWaiting);
    videoEl.addEventListener('playing', handlePlaying);
    videoEl.addEventListener('canplay', handleCanPlay);
    videoEl.addEventListener('stalled', handleStalled);
    videoEl.addEventListener('error', handleError);
    videoEl.addEventListener('timeupdate', handleTimeUpdate);
    videoEl.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoEl.addEventListener('durationchange', handleDurationChange);
    videoEl.addEventListener('progress', handleProgress);

    return () => {
      if (stallRecoveryTimerRef.current) {
        window.clearTimeout(stallRecoveryTimerRef.current);
        stallRecoveryTimerRef.current = null;
      }
      videoEl.removeEventListener('waiting', handleWaiting);
      videoEl.removeEventListener('playing', handlePlaying);
      videoEl.removeEventListener('canplay', handleCanPlay);
      videoEl.removeEventListener('stalled', handleStalled);
      videoEl.removeEventListener('error', handleError);
      videoEl.removeEventListener('timeupdate', handleTimeUpdate);
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoEl.removeEventListener('durationchange', handleDurationChange);
      videoEl.removeEventListener('progress', handleProgress);
    };
  }, [isActive, video.video_url]);

  // Reset tracking when video changes
  useEffect(() => {
    hasTrackedViewRef.current = false;
    analyticsTrackedRef.current = false;
    playAttemptRef.current = 0;
  }, [video.id]);

  const checkIfLiked = async () => {
    if (!currentUserId) return;
    const viewerStateKey = `${currentUserId}:${video.id}:${video.creator_id}`;
    
    const { data } = await supabase
      .from('likes')
      .select('id')
      .eq('video_id', video.id)
      .eq('user_id', currentUserId)
      .maybeSingle();

    const existingCache = viewerVideoStateCache.get(viewerStateKey);
    const nextLiked = !!data;
    viewerVideoStateCache.set(viewerStateKey, {
      liked: nextLiked,
      saved: existingCache?.saved ?? isSaved,
      following: existingCache?.following ?? isFollowing,
      blocked: existingCache?.blocked ?? isBlocked,
      fetchedAt: Date.now(),
    });

    setLiked(nextLiked);
  };

  const checkIfSaved = async () => {
    if (!currentUserId) return;
    const viewerStateKey = `${currentUserId}:${video.id}:${video.creator_id}`;
    
    const { data } = await supabase
      .from('saved_videos')
      .select('id')
      .eq('video_id', video.id)
      .eq('user_id', currentUserId)
      .maybeSingle();

    const existingCache = viewerVideoStateCache.get(viewerStateKey);
    const nextSaved = !!data;
    viewerVideoStateCache.set(viewerStateKey, {
      liked: existingCache?.liked ?? liked,
      saved: nextSaved,
      following: existingCache?.following ?? isFollowing,
      blocked: existingCache?.blocked ?? isBlocked,
      fetchedAt: Date.now(),
    });

    setIsSaved(nextSaved);
  };

  const incrementViewCount = async () => {
    try {
      // Use atomic RPC function to prevent race conditions
      await supabase.rpc('increment_video_views', { _video_id: video.id });
    } catch (error) {
      console.error('Failed to increment view count:', error);
    }
  };

  const trackVideoAnalytics = async (completed: boolean) => {
    if (analyticsTrackedRef.current) return;
    analyticsTrackedRef.current = true;

    const watchDuration = Math.floor((Date.now() - watchStartTimeRef.current) / 1000);
    
    if (watchDuration < 1) return;

    try {
      await supabase.from('video_analytics').insert({
        video_id: video.id,
        viewer_id: currentUserId || null,
        watch_duration: watchDuration,
        completed: completed,
        device_type: /Mobile|Android|iPhone/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      });
    } catch (error) {
      console.error('Failed to track analytics:', error);
    }
  };

  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    const handleEnded = () => {
      trackVideoAnalytics(true);
    };

    videoElement.addEventListener('ended', handleEnded);
    return () => videoElement.removeEventListener('ended', handleEnded);
  }, [video.id]);

  const checkIfFollowing = async () => {
    if (!currentUserId || currentUserId === video.creator_id) return;
    const viewerStateKey = `${currentUserId}:${video.id}:${video.creator_id}`;
    
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', currentUserId)
      .eq('following_id', video.creator_id)
      .maybeSingle();

    const existingCache = viewerVideoStateCache.get(viewerStateKey);
    const nextFollowing = !!data;
    viewerVideoStateCache.set(viewerStateKey, {
      liked: existingCache?.liked ?? liked,
      saved: existingCache?.saved ?? isSaved,
      following: nextFollowing,
      blocked: existingCache?.blocked ?? isBlocked,
      fetchedAt: Date.now(),
    });

    setIsFollowing(nextFollowing);
  };

  const checkIfBlocked = async () => {
    if (!currentUserId || currentUserId === video.creator_id) return;
    const viewerStateKey = `${currentUserId}:${video.id}:${video.creator_id}`;
    
    const { data } = await supabase
      .from('blocks')
      .select('id')
      .eq('blocker_id', currentUserId)
      .eq('blocked_id', video.creator_id)
      .maybeSingle();

    const existingCache = viewerVideoStateCache.get(viewerStateKey);
    const nextBlocked = !!data;
    viewerVideoStateCache.set(viewerStateKey, {
      liked: existingCache?.liked ?? liked,
      saved: existingCache?.saved ?? isSaved,
      following: existingCache?.following ?? isFollowing,
      blocked: nextBlocked,
      fetchedAt: Date.now(),
    });

    setIsBlocked(nextBlocked);
  };

  const handleBlock = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    if (!currentUserId) {
      toast.error('Please sign in to block users');
      return;
    }

    try {
      if (isBlocked) {
        await supabase
          .from('blocks')
          .delete()
          .eq('blocker_id', currentUserId)
          .eq('blocked_id', video.creator_id);
        setIsBlocked(false);
        toast.success('User unblocked');
      } else {
        await supabase
          .from('blocks')
          .insert({ blocker_id: currentUserId, blocked_id: video.creator_id });
        setIsBlocked(true);
        toast.success('User blocked. Their content will be hidden.');
      }
    } catch (error) {
      toast.error('Failed to update block status');
    }
  };

  const handleLike = async () => {
    triggerHaptic('medium');
    if (!currentUserId) {
      toast.error('Please sign in to like videos');
      return;
    }

    const viewerStateKey = `${currentUserId}:${video.id}:${video.creator_id}`;

    const nextLiked = !liked;
    const nextCount = Math.max(0, likesCount + (nextLiked ? 1 : -1));

    // Optimistic UI (instant feedback)
    setLiked(nextLiked);
    setLikesCount(nextCount);
    const existingCache = viewerVideoStateCache.get(viewerStateKey);
    viewerVideoStateCache.set(viewerStateKey, {
      liked: nextLiked,
      saved: existingCache?.saved ?? isSaved,
      following: existingCache?.following ?? isFollowing,
      blocked: existingCache?.blocked ?? isBlocked,
      fetchedAt: Date.now(),
    });

    try {
      // Just insert/delete the like - database trigger handles counter atomically
      if (nextLiked) {
        await supabase.from('likes').insert({ video_id: video.id, user_id: currentUserId });
        // Track positive action for rating prompt
        onPositiveAction?.();
      } else {
        await supabase.from('likes').delete().match({ video_id: video.id, user_id: currentUserId });
      }
      // Counter is now updated atomically via database trigger (update_video_likes_count)
    } catch (error) {
      // Rollback
      setLiked(liked);
      setLikesCount(likesCount);
      viewerVideoStateCache.set(viewerStateKey, {
        liked,
        saved: existingCache?.saved ?? isSaved,
        following: existingCache?.following ?? isFollowing,
        blocked: existingCache?.blocked ?? isBlocked,
        fetchedAt: Date.now(),
      });
      toast.error('Failed to like video');
    }
  };

  const handleTap = (e: React.TouchEvent | React.MouseEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Double tap - like with haptic and sound feedback
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = 'touches' in e ? e.changedTouches[0]?.clientX || 0 : e.clientX;
      const y = 'touches' in e ? e.changedTouches[0]?.clientY || 0 : e.clientY;
      
      const id = animationIdRef.current++;
      setLikeAnimations(prev => [...prev, { id, x, y }]);
      
      // Trigger haptic and sound feedback on like
      triggerLikeHaptic();
      playLikeSound();
      
      if (!liked) {
        handleLike();
      }
      lastTapRef.current = 0; // Reset to prevent triple tap
    } else {
      // Single tap - toggle play/pause with subtle feedback
      lastTapRef.current = now;
      setTimeout(() => {
        if (lastTapRef.current === now) {
          playTapSound();
          togglePlayPause();
        }
      }, DOUBLE_TAP_DELAY);
    }
  };

  // Swipe left to navigate to creator profile
  const handleSwipeStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleSwipeEnd = (e: React.TouchEvent) => {
    const deltaX = touchStartXRef.current - e.changedTouches[0].clientX;
    const deltaY = Math.abs(touchStartYRef.current - e.changedTouches[0].clientY);
    
    // Only trigger horizontal swipe if it's more horizontal than vertical
    if (Math.abs(deltaX) > 80 && deltaY < 50) {
      if (deltaX > 0) {
        // Swipe left - go to creator profile
        triggerHaptic('medium');
        navigate(`/profile?userId=${video.creator_id}`);
      }
    }
  };

  // Subtitle drag handlers
  const handleSubtitleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    setIsDraggingSubtitle(true);
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    subtitleDragStart.current = {
      x: clientX,
      y: clientY,
      posX: subtitlePosition.x,
      posY: subtitlePosition.y
    };
    
    // Add global listeners for drag
    if ('touches' in e) {
      document.addEventListener('touchmove', handleSubtitleDragMove as any);
      document.addEventListener('touchend', handleSubtitleDragEnd);
    } else {
      document.addEventListener('mousemove', handleSubtitleDragMove as any);
      document.addEventListener('mouseup', handleSubtitleDragEnd);
    }
  };

  const handleSubtitleDragMove = (e: MouseEvent | TouchEvent) => {
    if (!subtitleDragStart.current || !isDraggingSubtitle) return;
    e.preventDefault();
    
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    const deltaX = clientX - subtitleDragStart.current.x;
    const deltaY = subtitleDragStart.current.y - clientY; // Inverted for bottom positioning
    
    setSubtitlePosition({
      x: subtitleDragStart.current.posX + deltaX,
      y: Math.max(100, Math.min(window.innerHeight - 200, subtitleDragStart.current.posY + deltaY))
    });
  };

  const handleSubtitleDragEnd = () => {
    setIsDraggingSubtitle(false);
    subtitleDragStart.current = null;
    document.removeEventListener('mousemove', handleSubtitleDragMove as any);
    document.removeEventListener('mouseup', handleSubtitleDragEnd);
    document.removeEventListener('touchmove', handleSubtitleDragMove as any);
    document.removeEventListener('touchend', handleSubtitleDragEnd);
  };

  const togglePlayPause = () => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    if (isPlaying) {
      videoEl.pause();
      setIsPlaying(false);
    } else {
      videoEl.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      audioPreferenceRef.current = nextMuted ? 'muted' : 'unmuted';
      setIsMuted(nextMuted);
    }
  };

  const removeAnimation = (id: number) => {
    setLikeAnimations(prev => prev.filter(anim => anim.id !== id));
  };

  const handleProgressBarClick = useCallback((e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    e.stopPropagation();
    const progressBar = progressBarRef.current;
    const videoEl = videoRef.current;
    if (!progressBar || !videoEl || !duration) return;

    const rect = progressBar.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clickPosition = (clientX - rect.left) / rect.width;
    const newTime = clickPosition * duration;
    
    videoEl.currentTime = Math.max(0, Math.min(newTime, duration));
    setCurrentTime(newTime);
  }, [duration]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleQualityChange = async (quality: PlaybackQuality) => {
    setVideoQuality(quality);

    if (currentUserId) {
      const cached = playbackSettingsCache.get(currentUserId);
      playbackSettingsCache.set(currentUserId, {
        autoplay: cached?.autoplay ?? autoplayEnabled,
        videoQuality: quality,
        subtitlesEnabled: cached?.subtitlesEnabled ?? subtitlesEnabled,
        subtitlesSize: cached?.subtitlesSize ?? subtitlesSize,
        fetchedAt: Date.now(),
      });

      await supabase.from('playback_settings').upsert({
        user_id: currentUserId,
        autoplay: autoplayEnabled,
        video_quality: quality,
        subtitles_enabled: subtitlesEnabled,
        subtitles_size: subtitlesSize,
      });
    }

    toast.success(`Playback quality: ${quality === 'auto' ? 'Auto' : quality === 'high' ? 'HD' : 'SD'}`);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
    toast.success(`Playback speed: ${speed}x`);
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('medium');
    if (!currentUserId) {
      toast.error('Please sign in to follow creators');
      return;
    }

    try {
      const viewerStateKey = `${currentUserId}:${video.id}:${video.creator_id}`;
      const existingCache = viewerVideoStateCache.get(viewerStateKey);

      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', video.creator_id);
        setIsFollowing(false);
        viewerVideoStateCache.set(viewerStateKey, {
          liked: existingCache?.liked ?? liked,
          saved: existingCache?.saved ?? isSaved,
          following: false,
          blocked: existingCache?.blocked ?? isBlocked,
          fetchedAt: Date.now(),
        });
        toast.success('Unfollowed creator');
      } else {
        await supabase
          .from('follows')
          .insert({ follower_id: currentUserId, following_id: video.creator_id });
        setIsFollowing(true);
        viewerVideoStateCache.set(viewerStateKey, {
          liked: existingCache?.liked ?? liked,
          saved: existingCache?.saved ?? isSaved,
          following: true,
          blocked: existingCache?.blocked ?? isBlocked,
          fetchedAt: Date.now(),
        });
        toast.success('Following creator!');
      }
    } catch (error) {
      toast.error('Failed to update follow status');
    }
  };

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');
    if (!currentUserId) {
      toast.error('Please sign in to save videos');
      return;
    }

    try {
      const viewerStateKey = `${currentUserId}:${video.id}:${video.creator_id}`;
      const existingStateCache = viewerVideoStateCache.get(viewerStateKey);
      const existingEngagementCache = videoEngagementCache.get(video.id);

      if (isSaved) {
        await supabase
          .from('saved_videos')
          .delete()
          .eq('user_id', currentUserId)
          .eq('video_id', video.id);
        setIsSaved(false);
        setSavesCount(prev => Math.max(0, prev - 1));
        viewerVideoStateCache.set(viewerStateKey, {
          liked: existingStateCache?.liked ?? liked,
          saved: false,
          following: existingStateCache?.following ?? isFollowing,
          blocked: existingStateCache?.blocked ?? isBlocked,
          fetchedAt: Date.now(),
        });
        videoEngagementCache.set(video.id, {
          commentsCount: existingEngagementCache?.commentsCount ?? commentsCount,
          savesCount: Math.max(0, (existingEngagementCache?.savesCount ?? savesCount) - 1),
          fetchedAt: Date.now(),
        });
        toast.success('Removed from saved');
      } else {
        await supabase
          .from('saved_videos')
          .insert({ user_id: currentUserId, video_id: video.id });
        setIsSaved(true);
        setSavesCount(prev => prev + 1);
        viewerVideoStateCache.set(viewerStateKey, {
          liked: existingStateCache?.liked ?? liked,
          saved: true,
          following: existingStateCache?.following ?? isFollowing,
          blocked: existingStateCache?.blocked ?? isBlocked,
          fetchedAt: Date.now(),
        });
        videoEngagementCache.set(video.id, {
          commentsCount: existingEngagementCache?.commentsCount ?? commentsCount,
          savesCount: (existingEngagementCache?.savesCount ?? savesCount) + 1,
          fetchedAt: Date.now(),
        });
        toast.success('Saved to watch later!');
      }
    } catch (error) {
      toast.error('Failed to save video');
    }
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowDownloadDialog(true);
  };

  const handleDownloadWithQuality = async (quality: string, skipWatermark: boolean) => {
    setIsDownloading(true);
    setDownloadProgress(0);
    setDownloadStage('Preparing download...');
    
    try {
      // Use the secure Edge Function to get signed URL and log download
      const { data, error: functionError } = await supabase.functions.invoke('download-video', {
        body: { video_id: video.id }
      });
      
      if (functionError) {
        throw new Error(functionError.message || 'Download failed');
      }
      
      if (!data?.download_url) {
        throw new Error('No download URL received');
      }
      
      setDownloadStage('Downloading video...');
      setDownloadProgress(10);
      
      // Download the video
      const response = await fetch(data.download_url);
      if (!response.ok) throw new Error('Failed to fetch video');
      
      setDownloadProgress(30);
      const videoBlob = await response.blob();
      setDownloadProgress(50);
      
      let finalBlob: Blob;
      let fileExtension: string;
      
      // Skip watermark for premium users who selected the option
      if (skipWatermark && isPremium) {
        setDownloadStage('Preparing file...');
        setDownloadProgress(90);
        finalBlob = videoBlob;
        fileExtension = 'mp4';
      } else {
        setDownloadStage('Adding ToonlyReels watermark...');
        
        // Apply watermark client-side using Canvas API with cancellation support
        const controller = addWatermarkToVideo(
          videoBlob, 
          data.creator_username || 'ToonlyReels',
          (progress) => {
            setDownloadProgress(50 + Math.floor(progress * 0.45)); // 50-95%
          }
        );
        
        downloadControllerRef.current = controller;
        finalBlob = await controller.promise;
        fileExtension = 'webm';
      }
      
      setDownloadProgress(100);
      setDownloadStage('Complete!');
      
      // Create download link
      const url = URL.createObjectURL(finalBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${data.title || video.title}_ToonlyReels.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Haptic feedback and sound on successful download
      triggerHaptic('heavy');
      playSuccessSound();
      
      toast.success(skipWatermark ? 'Downloaded successfully!' : 'Downloaded with ToonlyReels watermark!');
    } catch (error) {
      if ((error as Error).message === 'Download cancelled') {
        toast.info('Download cancelled');
      } else {
        console.error('Download error:', error);
        toast.error('Failed to download video');
      }
    } finally {
      setIsDownloading(false);
      setDownloadProgress(0);
      downloadControllerRef.current = null;
    }
  };

  const handleCancelDownload = () => {
    if (downloadControllerRef.current) {
      downloadControllerRef.current.cancel();
    }
    setIsDownloading(false);
    setDownloadProgress(0);
  };

  const handleReport = async (reason: string) => {
    try {
      await supabase.from('reports').insert({
        reporter_id: currentUserId,
        reported_type: 'video',
        reported_id: video.id,
        reason
      });
      toast.success('Video reported. Thank you for keeping our community safe!');
      setShowReportDialog(false);
    } catch (error) {
      toast.error('Failed to report video');
    }
  };

  const handleDeleteVideo = async () => {
    try {
      const deleteToast = toast.loading('Deleting video...');
      
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', video.id);
      
      if (error) throw error;
      
      toast.success('Video deleted successfully!', { id: deleteToast });
      setShowDeleteDialog(false);
      
      // Call the onDelete callback to update parent state
      if (onDelete) {
        onDelete();
      }
    } catch (error) {
      console.error('Error deleting video:', error);
      toast.error('Failed to delete video');
    }
  };

  const handleActionClick = (e: React.MouseEvent, action: () => void) => {
    e.stopPropagation();
    action();
  };

  return (
    <>
      {/* Fullscreen backdrop for desktop/tablet - true fullscreen */}
      {isFullscreen && !isMobile && (
        <div 
          className="fixed inset-0 z-40 bg-black"
          onClick={() => toggleFullscreen()}
        />
      )}
      
      <div 
        className={`relative w-full bg-black snap-start snap-always ${
          isFullscreen && !isMobile 
            ? 'fixed inset-0 z-50 overflow-hidden' 
            : ''
        }`}
        style={{ 
          height: isFullscreen && !isMobile ? '100vh' : '100vh', 
          scrollSnapAlign: 'start',
          width: isFullscreen && !isMobile ? '100vw' : '100%',
        }}
      >
      {/* Like animations */}
      {likeAnimations.map(anim => (
        <LikeAnimation
          key={anim.id}
          x={anim.x}
          y={anim.y}
          onComplete={() => removeAnimation(anim.id)}
        />
      ))}
      
      {/* Video container with tap handler and swipe gestures */}
      <div 
        className="absolute inset-0 flex items-center justify-center"
        onClick={handleTap}
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
      >
          <video
            ref={videoRef}
            src={isTouchPlaybackDevice ? undefined : video.video_url}
            className="w-full h-full object-contain"
            loop={isLooping}
            muted={isMuted}
            playsInline
            webkit-playsinline="true"
            x5-playsinline="true"
            x5-video-player-type="h5"
            preload={activeVideoPreload}
            autoPlay={false}
            disablePictureInPicture
            disableRemotePlayback
            style={{ 
              maxHeight: '100vh',
              marginBottom: '0',
              WebkitTransform: 'translateZ(0)',
            }}
          />
        
        {/* Buffering indicator */}
        {isBuffering && isActive && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="animate-spin rounded-full h-10 w-10 border-3 border-white border-t-transparent" />
          </div>
        )}
        
        {/* Play/Pause indicator - only show when user manually paused via tap */}
      </div>
      
      {/* Subtitle Display - Draggable */}
      {subtitlesEnabled && currentSubtitle && (
        <div 
          ref={subtitleRef}
          className={`absolute z-30 flex justify-center px-4 cursor-grab active:cursor-grabbing select-none ${isDraggingSubtitle ? 'pointer-events-auto' : 'pointer-events-auto'}`}
          style={{ 
            bottom: `${subtitlePosition.y}px`,
            left: '50%',
            transform: `translateX(calc(-50% + ${subtitlePosition.x}px))`,
            touchAction: 'none'
          }}
          onMouseDown={handleSubtitleDragStart}
          onTouchStart={handleSubtitleDragStart}
        >
          <div className="bg-black/70 rounded-lg px-4 py-2 max-w-[90%]">
            <p className={`text-white text-center font-medium leading-relaxed ${
              subtitlesSize === 'small' ? 'text-xs' : 
              subtitlesSize === 'large' ? 'text-lg' : 
              'text-sm'
            }`}>
              {currentSubtitle}
            </p>
          </div>
        </div>
      )}
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      
      {/* ToonlyReels Branding - Top Left */}
      <div className="absolute top-12 left-3 z-20">
        <span className="text-white/40 text-xl font-bold tracking-wide">ToonlyReels</span>
      </div>
      
      {/* Top Controls - aligned with ToonlyReels branding */}
      <div className="absolute top-12 right-3 z-20 flex items-center gap-2">
        {/* Settings (Quality & Speed) */}
        <DropdownMenu open={showSettingsMenu} onOpenChange={setShowSettingsMenu}>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              onClick={(e) => e.stopPropagation()}
              className="rounded-full h-8 w-8 bg-black/40 text-white hover:bg-black/60"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[140px] bg-background z-50" onClick={(e) => e.stopPropagation()}>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Quality</div>
            <DropdownMenuItem 
              onClick={() => handleQualityChange('auto')}
              className={videoQuality === 'auto' ? 'bg-primary/10 text-primary' : ''}
            >
              Auto (Recommended)
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleQualityChange('high')}
              className={videoQuality === 'high' ? 'bg-primary/10 text-primary' : ''}
            >
              HD (720p+)
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => handleQualityChange('medium')}
              className={videoQuality === 'medium' ? 'bg-primary/10 text-primary' : ''}
            >
              SD (480p)
            </DropdownMenuItem>
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Speed</div>
            {[0.5, 1, 1.5, 2].map((speed) => (
              <DropdownMenuItem 
                key={speed}
                onClick={() => handleSpeedChange(speed)}
                className={playbackSpeed === speed ? 'bg-primary/10 text-primary' : ''}
              >
                {speed}x {speed === 1 && '(Normal)'}
              </DropdownMenuItem>
            ))}
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Loop</div>
            <DropdownMenuItem 
              onClick={() => {
                setIsLooping(!isLooping);
                toast.success(isLooping ? 'Loop disabled' : 'Loop enabled');
              }}
              className="flex items-center gap-2"
            >
              <Repeat className={`h-4 w-4 ${isLooping ? 'text-primary' : ''}`} />
              {isLooping ? 'Disable Loop' : 'Enable Loop'}
            </DropdownMenuItem>
            {video.subtitles && video.subtitles.length > 0 && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Subtitles</div>
                <DropdownMenuItem 
                  onClick={() => {
                    setSubtitlesEnabled(!subtitlesEnabled);
                    toast.success(subtitlesEnabled ? 'Subtitles disabled' : 'Subtitles enabled');
                  }}
                  className="flex items-center gap-2"
                >
                  <Subtitles className={`h-4 w-4 ${subtitlesEnabled ? 'text-primary' : ''}`} />
                  {subtitlesEnabled ? 'Hide Subtitles' : 'Show Subtitles'}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Volume Control */}
        <Button
          size="icon"
          variant="ghost"
          onClick={toggleMute}
          className="rounded-full h-8 w-8 bg-black/40 text-white hover:bg-black/60"
        >
          {isMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>
      
      {/* Progress Bar */}
      <div 
        className="absolute left-0 right-0 z-20 px-3"
        style={{ bottom: isMobile ? '100px' : '86px' }}
      >
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/80 font-medium min-w-[32px]">
            {formatTime(currentTime)}
          </span>
          <div
            ref={progressBarRef}
            className="flex-1 h-1 bg-white/20 rounded-full cursor-pointer relative group"
            onClick={handleProgressBarClick}
            onTouchStart={handleProgressBarClick}
          >
            {/* Buffered progress */}
            <div 
              className="absolute inset-0 h-full bg-white/40 rounded-full"
              style={{ width: `${bufferedPercent}%` }}
            />
            {/* Playback progress */}
            <div 
              className="absolute inset-0 h-full bg-primary rounded-full transition-all duration-100"
              style={{ width: `${progressPercent}%` }}
            >
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
            </div>
          </div>
          <span className="text-[10px] text-white/80 font-medium min-w-[32px] text-right">
            {formatTime(duration)}
          </span>
        </div>
      </div>
      
      {/* Video Info */}
      <div className="absolute left-2 right-14 text-white z-10" style={{ bottom: isMobile ? '120px' : '120px' }}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <div 
            className="flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/profile?userId=${video.creator_id}`);
            }}
          >
            <Avatar className="h-6 w-6 border border-white/30">
              <AvatarImage src={video.profiles.avatar_url || undefined} alt={video.profiles.username} />
              <AvatarFallback className="bg-primary text-background text-[10px] font-bold">
                {video.profiles.username[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="font-medium text-xs">{video.profiles.username}</span>
            {video.profiles.is_verified && video.profiles.username === 'ToonlyReelsOff' ? (
              <span className="text-yellow-400 text-sm drop-shadow-[0_0_1px_rgba(0,0,0,1)] [text-shadow:_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000,_1px_1px_0_#000]">
                ⭐
              </span>
            ) : video.profiles.is_verified && (
              <BadgeCheck className="h-4 w-4 text-blue-500 drop-shadow-lg" fill="white" />
            )}
          </div>
          
          {/* Follow/Following button */}
          {currentUserId && !isOwnVideo && (
            <button
              onClick={handleFollow}
              className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                isFollowing 
                  ? 'bg-white/20 text-white' 
                  : 'bg-primary text-primary-foreground'
              }`}
            >
              {isFollowing ? 'Following' : 'Follow'}
            </button>
          )}
        </div>
        {/* Title with See more */}
        <p 
          className={`text-xs font-semibold leading-tight mb-0.5 cursor-pointer`}
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
        >
          {!isExpanded && video.title.length > 60 ? (
            <>{video.title.slice(0, 60)}... <span className="text-white/60 font-normal">See more</span></>
          ) : (
            video.title
          )}
        </p>
        {/* Hashtags under title - blue and clickable with trending indicator */}
        {video.tags && video.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-0.5">
            {(isExpanded ? video.tags : video.tags.slice(0, 3)).map((tag, i) => {
              const isTrending = trendingTags.includes(tag);
              return (
                <span 
                  key={i} 
                  className="text-[10px] text-blue-400 font-medium cursor-pointer hover:text-blue-300 hover:underline transition-colors flex items-center gap-0.5"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/search?tag=${encodeURIComponent(tag)}`);
                  }}
                >
                  #{tag.length > 15 ? tag.slice(0, 15) + '…' : tag}
                  {isTrending && <span className="text-[8px]">🔥</span>}
                </span>
              );
            })}
            {!isExpanded && video.tags.length > 3 && (
              <span 
                className="text-[10px] text-white/60 cursor-pointer"
                onClick={(e) => { e.stopPropagation(); setIsExpanded(true); }}
              >
                ...See more
              </span>
            )}
          </div>
        )}
        {/* Description - shown when expanded */}
        {isExpanded && video.description && video.description !== video.title && (
          <p className="text-[10px] opacity-80 leading-tight mt-1">
            {video.description}
          </p>
        )}
        {isExpanded && (
          <span 
            className="text-[10px] text-white/60 cursor-pointer mt-0.5 inline-block"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
          >
            Show less
          </span>
        )}
      </div>

      {/* Action Buttons */}
      <div className="absolute right-1 flex flex-col gap-2 z-10" style={{ bottom: isMobile ? '120px' : '120px' }}>
        {/* Like */}
        <button
          onClick={(e) => handleActionClick(e, handleLike)}
          className="flex flex-col items-center"
        >
          <div className={`rounded-full h-9 w-9 flex items-center justify-center ${liked ? 'text-primary' : 'text-white'}`}>
            <Heart className={`h-5 w-5 ${liked ? 'fill-current' : ''}`} />
          </div>
          <span className="text-[9px] text-white font-medium">{likesCount}</span>
        </button>

        {/* Comment */}
        <button
          onClick={(e) => handleActionClick(e, onCommentsClick)}
          className="flex flex-col items-center"
        >
          <div className="rounded-full h-9 w-9 flex items-center justify-center text-white">
            <MessageCircle className="h-5 w-5" />
          </div>
          <span className="text-[9px] text-white font-medium">{commentsCount}</span>
        </button>

        {/* Send Stars - only for non-owners */}
        {!isOwnVideo && (
          <button
            onClick={(e) => handleActionClick(e, () => setShowStarsDialog(true))}
            className="flex flex-col items-center"
          >
            <div className="rounded-full h-9 w-9 flex items-center justify-center text-yellow-500">
              <Star className="h-5 w-5 fill-current" />
            </div>
            <span className="text-[9px] text-white font-medium">Stars</span>
          </button>
        )}

        {/* Save - only for non-owners */}
        {!isOwnVideo && (
          <button
            onClick={handleSave}
            className="flex flex-col items-center"
          >
            <div className={`rounded-full h-9 w-9 flex items-center justify-center ${isSaved ? 'text-primary' : 'text-white'}`}>
              {isSaved ? (
                <BookmarkCheck className="h-5 w-5 fill-current" />
              ) : (
                <Bookmark className="h-5 w-5" />
              )}
            </div>
            <span className="text-[9px] text-white font-medium">{savesCount}</span>
          </button>
        )}

        {/* Download - only for non-owners */}
        {!isOwnVideo && (
          <button
            onClick={handleDownload}
            className="flex flex-col items-center"
          >
            <div className="rounded-full h-9 w-9 flex items-center justify-center text-white">
              <Download className="h-5 w-5" />
            </div>
            <span className="text-[9px] text-white font-medium">Download</span>
          </button>
        )}

        {/* Report - only for non-owners */}
        {!isOwnVideo && (
          <button
            onClick={(e) => handleActionClick(e, () => setShowReportDialog(true))}
            className="flex flex-col items-center"
          >
            <div className="rounded-full h-9 w-9 flex items-center justify-center text-white">
              <Flag className="h-5 w-5" />
            </div>
            <span className="text-[9px] text-white font-medium">Report</span>
          </button>
        )}

        {/* Block - only for non-owners */}
        {!isOwnVideo && (
          <button
            onClick={handleBlock}
            className="flex flex-col items-center"
          >
            <div className={`rounded-full h-9 w-9 flex items-center justify-center ${isBlocked ? 'text-destructive' : 'text-white'}`}>
              <Ban className="h-5 w-5" />
            </div>
            <span className="text-[9px] text-white font-medium">{isBlocked ? 'Unblock' : 'Block'}</span>
          </button>
        )}

        {/* Delete - only for owners */}
        {isOwnVideo && (
          <button
            onClick={(e) => handleActionClick(e, () => setShowDeleteDialog(true))}
            className="flex flex-col items-center"
          >
            <div className="rounded-full h-9 w-9 flex items-center justify-center text-destructive">
              <Trash2 className="h-5 w-5" />
            </div>
            <span className="text-[9px] text-white font-medium">Delete</span>
          </button>
        )}
      </div>

      {/* Report Dialog */}
      {showReportDialog && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowReportDialog(false)}>
          <div className="bg-background rounded-xl p-4 w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-lg mb-4">Report Video</h3>
            <div className="space-y-2">
              {['Inappropriate content', 'Violence or harmful content', 'Spam or misleading', 'Copyright violation', 'Other'].map(reason => (
                <button
                  key={reason}
                  onClick={() => handleReport(reason)}
                  className="w-full text-left px-4 py-3 rounded-lg hover:bg-muted transition-colors text-sm"
                >
                  {reason}
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowReportDialog(false)}
              className="w-full mt-4 text-muted-foreground text-sm"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent onClick={(e) => e.stopPropagation()}>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete your video
              and remove it from our servers.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteVideo}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Download Quality Dialog */}
      <DownloadQualityDialog
        open={showDownloadDialog}
        onOpenChange={setShowDownloadDialog}
        onSelectQuality={handleDownloadWithQuality}
        videoTitle={video.title}
        isPremium={isPremium}
      />

      {/* Download Progress Overlay */}
      {isDownloading && (
        <DownloadProgressOverlay
          progress={downloadProgress}
          stage={downloadStage}
          onCancel={handleCancelDownload}
        />
      )}

      {/* Send Stars Dialog */}
      <SendStarsDialog
        open={showStarsDialog}
        onOpenChange={setShowStarsDialog}
        creatorId={video.creator_id}
        creatorUsername={video.profiles.username}
        videoId={video.id}
        currentUserId={currentUserId}
      />
    </div>
    </>
  );
};

export default VideoPlayer;
