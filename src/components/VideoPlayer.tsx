import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Download, Flag, Trash2, Volume2, VolumeX, Bookmark, BookmarkCheck, Settings, Repeat, Ban, BadgeCheck, Subtitles, Star, Wifi, AlertTriangle, Zap, Eye, Share2 } from 'lucide-react';
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
import { useFollowRealtime } from '@/hooks/useFollowRealtime';
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

interface SubtitleSegmentWord {
  text: string;
  start: number;
  end: number;
}

interface SubtitleSegment {
  id: number;
  text: string;
  start: number;
  end: number;
  words?: SubtitleSegmentWord[];
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
    comments_count?: number;
    saves_count?: number;
    shares_count?: number;
    tags?: string[] | null;
    thumbnail_url?: string | null;
    subtitles?: SubtitleSegment[] | null;
    transcription_status?: string | null;
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
  subtitlesSize: 'small' | 'medium' | 'large' | 'xl';
  subtitlesPosition: 'top' | 'middle' | 'bottom';
  subtitlesBackground: 'solid' | 'translucent' | 'none';
  subtitlesKaraoke: boolean;
  fetchedAt: number;
}

interface CachedVideoEngagement {
  commentsCount: number;
  savesCount: number;
  sharesCount: number;
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
let globalAudioPreference: 'muted' | 'unmuted' = 'unmuted';
let playbackUnlockedByUser = false;
let globallyActiveVideoElement: HTMLVideoElement | null = null;
let globallyActiveVideoId: string | null = null;

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

const getNetworkIndicatorConfig = (profile: ReturnType<typeof getPlaybackNetworkProfile>) => {
  if (profile.saveData) {
    return {
      label: 'Data saver on',
      detail: 'Videos may start in lighter mode',
      icon: AlertTriangle,
      tone: 'warning' as const,
    };
  }

  if (profile.isSlowConnection) {
    return {
      label: 'Slow connection',
      detail: 'Loading may take a little longer',
      icon: Wifi,
      tone: 'slow' as const,
    };
  }

  return {
    label: 'Fast connection',
    detail: 'Reels should start quickly',
    icon: Zap,
    tone: 'good' as const,
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
  const [viewsCount, setViewsCount] = useState(video.views_count || 0);
  const [commentsCount, setCommentsCount] = useState(video.comments_count || 0);
  const [savesCount, setSavesCount] = useState(video.saves_count || 0);
  const [sharesCount, setSharesCount] = useState(video.shares_count || 0);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [showDownloadDialog, setShowDownloadDialog] = useState(false);
  const [likeAnimations, setLikeAnimations] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const [isMuted, setIsMuted] = useState(globalAudioPreference === 'muted');
  const [isPlaying, setIsPlaying] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [requiresManualPlay, setRequiresManualPlay] = useState(false);
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
  const [subtitlesSize, setSubtitlesSize] = useState<'small' | 'medium' | 'large' | 'xl'>('medium');
  const [subtitlesPosition, setSubtitlesPosition] = useState<'top' | 'middle' | 'bottom'>('bottom');
  const [subtitlesBackground, setSubtitlesBackground] = useState<'solid' | 'translucent' | 'none'>('solid');
  const [subtitlesKaraoke, setSubtitlesKaraoke] = useState(true);
  const [currentSubtitle, setCurrentSubtitle] = useState<string>('');
  const [currentSubtitleSeg, setCurrentSubtitleSeg] = useState<SubtitleSegment | null>(null);
  const [retryingTranscription, setRetryingTranscription] = useState(false);
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
  const audioPreferenceRef = useRef<'muted' | 'unmuted'>(globalAudioPreference);
  const deferredDataFetchTimerRef = useRef<number | null>(null);
  const stallRecoveryTimerRef = useRef<number | null>(null);
  const playRequestRef = useRef<Promise<boolean> | null>(null);
  const waitingRecoveryTimerRef = useRef<number | null>(null);
  const lastRecoveryAtRef = useRef<number>(0);
  const userPausedRef = useRef(false);

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
  const shouldStartMuted = audioPreferenceRef.current === 'muted';
  const activeVideoPreload = isActive
    ? networkProfile.saveData
      ? 'metadata'
      : 'auto'
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
      setSharesCount(cachedEngagement.sharesCount);
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
        tasks.push(Promise.allSettled([fetchEngagementCounts()]));
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
    const cached = sessionStorage.getItem('diskiereels_trending_tags');
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
    sessionStorage.setItem('diskiereels_trending_tags', JSON.stringify({
      tags: topTags,
      timestamp: Date.now()
    }));
  };

  const syncMuteState = useCallback((nextMuted: boolean) => {
    globalAudioPreference = nextMuted ? 'muted' : 'unmuted';
    audioPreferenceRef.current = globalAudioPreference;
    setIsMuted(nextMuted);

    const videoEl = videoRef.current;
    if (videoEl) {
      videoEl.muted = nextMuted;
      videoEl.defaultMuted = nextMuted;
      if (!nextMuted) {
        videoEl.volume = 1;
      }
    }
  }, []);

  const ensureVideoSource = useCallback((videoEl: HTMLVideoElement) => {
    const currentSrc = videoEl.getAttribute('src');
    const sourceNeedsRefresh = !currentSrc || currentSrc !== video.video_url || videoEl.src === window.location.href;

    if (sourceNeedsRefresh) {
      videoEl.src = video.video_url;
    }

    if (sourceNeedsRefresh || videoEl.readyState === 0) {
      videoEl.load();
    }
  }, [video.video_url]);

  const claimGlobalPlayback = useCallback((videoEl: HTMLVideoElement) => {
    const previousActiveVideo = globallyActiveVideoElement && globallyActiveVideoElement !== videoEl
      ? globallyActiveVideoElement
      : null;
    globallyActiveVideoElement = videoEl;
    globallyActiveVideoId = video.id;

    previousActiveVideo?.pause();
  }, [video.id]);

  const isGlobalPlaybackOwner = useCallback(() => globallyActiveVideoId === video.id, [video.id]);

  const waitForVideoReady = useCallback(
    (videoEl: HTMLVideoElement, userInitiated: boolean) => {
      if (videoEl.readyState >= (isTouchPlaybackDevice ? 1 : 2)) {
        return Promise.resolve();
      }

      const waitTime = userInitiated ? 1400 : isTouchPlaybackDevice ? 650 : effectiveVideoQuality === 'high' ? 700 : 950;

      return new Promise<void>((resolve) => {
        const onReady = () => {
          window.clearTimeout(timeoutId);
          videoEl.removeEventListener('canplay', onReady);
          videoEl.removeEventListener('loadeddata', onReady);
          videoEl.removeEventListener('loadedmetadata', onReady);
          videoEl.removeEventListener('canplaythrough', onReady);
          videoEl.removeEventListener('error', onReady);
          resolve();
        };

        const timeoutId = window.setTimeout(onReady, waitTime);

        videoEl.addEventListener('canplay', onReady);
        videoEl.addEventListener('loadeddata', onReady);
        videoEl.addEventListener('loadedmetadata', onReady);
        videoEl.addEventListener('canplaythrough', onReady);
        videoEl.addEventListener('error', onReady);
      });
    },
    [effectiveVideoQuality, isTouchPlaybackDevice]
  );

  const playVideo = useCallback(
    async (userInitiated: boolean = false) => {
      if (playRequestRef.current) {
        return playRequestRef.current;
      }

      const videoEl = videoRef.current;
      if (!videoEl) return false;

      const playRequest = (async () => {
        try {
        playAttemptRef.current++;
        userPausedRef.current = false;
        setRequiresManualPlay(false);
        setIsBuffering(true);

        claimGlobalPlayback(videoEl);
        ensureVideoSource(videoEl);
        await waitForVideoReady(videoEl, userInitiated);

        if (videoEl.duration && videoEl.currentTime >= videoEl.duration - 0.5) {
          videoEl.currentTime = 0;
        }

        if (userInitiated) {
          playbackUnlockedByUser = true;
        }

        const startMuted = userInitiated
          ? audioPreferenceRef.current === 'muted'
          : isTouchPlaybackDevice && !playbackUnlockedByUser
            ? true
            : audioPreferenceRef.current === 'muted';
        videoEl.defaultMuted = startMuted;
        videoEl.muted = startMuted;
        if (!startMuted) {
          videoEl.volume = 1;
        }

        await videoEl.play();

        setIsMuted(startMuted);
        setIsPlaying(true);
        setIsBuffering(false);
        setRequiresManualPlay(false);

        if (!hasTrackedViewRef.current) {
          incrementViewCount();
          hasTrackedViewRef.current = true;
          watchStartTimeRef.current = Date.now();
          analyticsTrackedRef.current = false;
        }

        return true;
      } catch (error) {
        if (!userInitiated && !videoEl.muted) {
          try {
            videoEl.defaultMuted = true;
            videoEl.muted = true;
            await videoEl.play();

            setIsMuted(true);
            setIsPlaying(true);
            setIsBuffering(false);
            setRequiresManualPlay(false);

            if (!hasTrackedViewRef.current) {
              incrementViewCount();
              hasTrackedViewRef.current = true;
              watchStartTimeRef.current = Date.now();
              analyticsTrackedRef.current = false;
            }

            return true;
          } catch {
            // fall through to manual play fallback below
          }
        }

        setRequiresManualPlay(!userInitiated);
        setIsPlaying(false);
        setIsBuffering(false);
        return false;
        } finally {
          playRequestRef.current = null;
        }
      })();

      playRequestRef.current = playRequest;
      return playRequest;
    },
    [claimGlobalPlayback, ensureVideoSource, waitForVideoReady, isTouchPlaybackDevice]
  );

  const fetchPlaybackSettings = async () => {
    if (!currentUserId) return;

    const cached = playbackSettingsCache.get(currentUserId);
    if (cached && Date.now() - cached.fetchedAt < PLAYBACK_SETTINGS_TTL) {
      setAutoplayEnabled(cached.autoplay);
      setVideoQuality(cached.videoQuality);
      setSubtitlesEnabled(cached.subtitlesEnabled);
      setSubtitlesSize(cached.subtitlesSize);
      setSubtitlesPosition(cached.subtitlesPosition);
      setSubtitlesBackground(cached.subtitlesBackground);
      setSubtitlesKaraoke(cached.subtitlesKaraoke);
      return;
    }

    const { data } = await supabase
      .from('playback_settings')
      .select('*')
      .eq('user_id', currentUserId)
      .maybeSingle();

    const d = data as any;
    const resolvedSettings: CachedPlaybackSettings = {
      autoplay: d?.autoplay ?? true,
      videoQuality: normalizePlaybackQuality(d?.video_quality),
      subtitlesEnabled: d?.subtitles_enabled ?? true,
      subtitlesSize: (d?.subtitles_size as any) || 'medium',
      subtitlesPosition: (d?.subtitles_position as any) || 'bottom',
      subtitlesBackground: (d?.subtitles_background as any) || 'solid',
      subtitlesKaraoke: d?.subtitles_karaoke !== false,
      fetchedAt: Date.now(),
    };

    playbackSettingsCache.set(currentUserId, resolvedSettings);
    setAutoplayEnabled(resolvedSettings.autoplay);
    setVideoQuality(resolvedSettings.videoQuality);
    setSubtitlesEnabled(resolvedSettings.subtitlesEnabled);
    setSubtitlesSize(resolvedSettings.subtitlesSize);
    setSubtitlesPosition(resolvedSettings.subtitlesPosition);
    setSubtitlesBackground(resolvedSettings.subtitlesBackground);
    setSubtitlesKaraoke(resolvedSettings.subtitlesKaraoke);
  };

  const applyVideoCounters = useCallback((row: Partial<VideoPlayerProps['video']>) => {
    if (typeof row.likes_count === 'number') setLikesCount(row.likes_count);
    if (typeof row.views_count === 'number') setViewsCount(row.views_count);
    if (typeof row.comments_count === 'number') setCommentsCount(row.comments_count);
    if (typeof row.saves_count === 'number') setSavesCount(row.saves_count);
    if (typeof row.shares_count === 'number') setSharesCount(row.shares_count);
  }, []);

  const cacheEngagementCounts = useCallback((nextComments: number, nextSaves: number, nextShares: number) => {
    videoEngagementCache.set(video.id, {
      commentsCount: nextComments,
      savesCount: nextSaves,
      sharesCount: nextShares,
      fetchedAt: Date.now(),
    });
  }, [video.id]);

  const fetchEngagementCounts = async () => {
    const { data } = await supabase
      .from('videos')
      .select('likes_count, views_count, comments_count, saves_count, shares_count')
      .eq('id', video.id)
      .maybeSingle();

    if (data) {
      applyVideoCounters(data);
      cacheEngagementCounts(data.comments_count || 0, data.saves_count || 0, data.shares_count || 0);
    }
  };

  useEffect(() => {
    setLikesCount(video.likes_count || 0);
    setViewsCount(video.views_count || 0);
    setCommentsCount(video.comments_count || 0);
    setSavesCount(video.saves_count || 0);
    setSharesCount(video.shares_count || 0);
  }, [video.id, video.likes_count, video.views_count, video.comments_count, video.saves_count, video.shares_count]);

  useEffect(() => {
    if (!isActive) return;

    const channel = supabase
      .channel(`video-engagement-${video.id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'videos', filter: `id=eq.${video.id}` },
        (payload) => {
          const next = payload.new as Partial<VideoPlayerProps['video']>;
          applyVideoCounters(next);
          cacheEngagementCounts(next.comments_count || 0, next.saves_count || 0, next.shares_count || 0);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [video.id, isActive, applyVideoCounters, cacheEngagementCounts]);

  // Handle active state - play/pause based on visibility with better mobile support
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    videoEl.playbackRate = playbackSpeed;
    videoEl.loop = isLooping;
    videoEl.preload = activeVideoPreload;

    if (!isActive) {
      userPausedRef.current = false;
      videoEl.pause();
      if (globallyActiveVideoElement === videoEl) {
        globallyActiveVideoElement = null;
        globallyActiveVideoId = null;
      }
      setIsPlaying(false);
      setIsBuffering(false);
      setRequiresManualPlay(false);
      if (stallRecoveryTimerRef.current) {
        window.clearTimeout(stallRecoveryTimerRef.current);
        stallRecoveryTimerRef.current = null;
      }
      if (!analyticsTrackedRef.current && hasTrackedViewRef.current) {
        trackVideoAnalytics(false);
      }

      return;
    }

    if (!autoplayEnabled) {
      ensureVideoSource(videoEl);
      videoEl.pause();
      videoEl.muted = shouldStartMuted;
      videoEl.defaultMuted = shouldStartMuted;
      setIsMuted(shouldStartMuted);
      setIsPlaying(false);
      setIsBuffering(false);
      setRequiresManualPlay(false);
      return;
    }

    let isCancelled = false;
    
    const attemptPlay = async () => {
      if (isCancelled) return;
      const played = await playVideo(false);
      if (isCancelled) return;
      if (!played) {
        setIsBuffering(false);
      }
    };

    void attemptPlay();
    
    return () => {
      isCancelled = true;
      if (globallyActiveVideoElement === videoEl) {
        globallyActiveVideoElement = null;
        globallyActiveVideoId = null;
      }
    };
  }, [isActive, autoplayEnabled, shouldStartMuted, playbackSpeed, isLooping, activeVideoPreload, ensureVideoSource, playVideo]);

  // Handle video events for better mobile playback
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const handleWaiting = () => {
      if (!isBufferingRef.current) {
        isBufferingRef.current = true;
        setIsBuffering(true);
      }

      if (waitingRecoveryTimerRef.current) {
        window.clearTimeout(waitingRecoveryTimerRef.current);
      }

      waitingRecoveryTimerRef.current = window.setTimeout(() => {
        if (!isActive || !isGlobalPlaybackOwner() || userPausedRef.current || requiresManualPlay || document.hidden) {
          return;
        }

        if (videoEl.readyState <= 1) {
          ensureVideoSource(videoEl);
          videoEl.load();
        }

        void playVideo(false);
      }, networkProfile.isSlowConnection ? 1600 : 900);
    };
    const handlePlaying = () => {
      setIsPlaying(true);
      if (isBufferingRef.current) {
        isBufferingRef.current = false;
        setIsBuffering(false);
      }
      stallCountRef.current = 0;
      if (waitingRecoveryTimerRef.current) {
        window.clearTimeout(waitingRecoveryTimerRef.current);
        waitingRecoveryTimerRef.current = null;
      }
    };
    const handleCanPlay = () => {
      if (isBufferingRef.current) {
        isBufferingRef.current = false;
        setIsBuffering(false);
      }

      if (isActive && isGlobalPlaybackOwner() && !userPausedRef.current && videoEl.paused && !requiresManualPlay) {
        void playVideo(false);
      }
    };
    const handlePause = () => {
      setIsPlaying(false);

      if (!isActive || !isGlobalPlaybackOwner() || videoEl.ended || userPausedRef.current || requiresManualPlay) {
        return;
      }

      if (stallRecoveryTimerRef.current) {
        window.clearTimeout(stallRecoveryTimerRef.current);
      }
      if (waitingRecoveryTimerRef.current) {
        window.clearTimeout(waitingRecoveryTimerRef.current);
        waitingRecoveryTimerRef.current = null;
      }

      stallRecoveryTimerRef.current = window.setTimeout(() => {
        if (!isActive || !isGlobalPlaybackOwner() || userPausedRef.current || requiresManualPlay || !videoEl.paused || videoEl.ended) {
          return;
        }

        void playVideo(false);
      }, 250);
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
        void playVideo(false);
      };

      videoEl.addEventListener('loadedmetadata', restorePlayback, { once: true });
      ensureVideoSource(videoEl);
      videoEl.load();
    };
    
    const handleStalled = () => {
      if (!isActive || !isGlobalPlaybackOwner()) return;
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
            void playVideo(false);
          }
          return;
        }

        if (count <= 4 && Number.isFinite(videoEl.duration) && videoEl.duration > 0) {
          videoEl.currentTime = Math.min(videoEl.currentTime + 0.05, Math.max(videoEl.duration - 0.1, 0));
          void playVideo(false);
          return;
        }

        reloadVideoFromCurrentPosition();
      }, delay);
    };
    
    const handleError = () => {
      if (!isActive || !isGlobalPlaybackOwner()) return;
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
          setCurrentSubtitleSeg(prev => (prev?.id === activeSubtitle?.id ? prev : (activeSubtitle || null)));
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
    videoEl.addEventListener('pause', handlePause);
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
      if (waitingRecoveryTimerRef.current) {
        window.clearTimeout(waitingRecoveryTimerRef.current);
        waitingRecoveryTimerRef.current = null;
      }
      videoEl.removeEventListener('waiting', handleWaiting);
      videoEl.removeEventListener('playing', handlePlaying);
      videoEl.removeEventListener('canplay', handleCanPlay);
      videoEl.removeEventListener('pause', handlePause);
      videoEl.removeEventListener('stalled', handleStalled);
      videoEl.removeEventListener('error', handleError);
      videoEl.removeEventListener('timeupdate', handleTimeUpdate);
      videoEl.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoEl.removeEventListener('durationchange', handleDurationChange);
      videoEl.removeEventListener('progress', handleProgress);
    };
  }, [ensureVideoSource, isActive, isGlobalPlaybackOwner, networkProfile.isSlowConnection, playVideo, requiresManualPlay, video.video_url]);

  useEffect(() => {
    if (!isActive || requiresManualPlay) return;

    const intervalId = window.setInterval(() => {
      const videoEl = videoRef.current;
      if (!videoEl || !isGlobalPlaybackOwner() || document.hidden || userPausedRef.current || videoEl.ended) return;

      if (videoEl.paused && videoEl.readyState >= 2) {
        void playVideo(false);
      }
    }, 1200);

    return () => window.clearInterval(intervalId);
  }, [isActive, isGlobalPlaybackOwner, playVideo, requiresManualPlay]);

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
      setViewsCount(prev => prev + 1);
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
      userPausedRef.current = true;
      videoEl.pause();
      setIsPlaying(false);
      setIsBuffering(false);
    } else {
      playbackUnlockedByUser = true;
      void playVideo(true);
    }
  };

  const toggleMute = (e: React.MouseEvent) => {
    e.stopPropagation();
    const videoEl = videoRef.current;
    if (videoEl) {
      const nextMuted = !isMuted;
      syncMuteState(nextMuted);

      if (!nextMuted) {
        playbackUnlockedByUser = true;
      }

      if (!nextMuted && isActive && videoEl.paused) {
        void playVideo(true);
      }
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
        subtitlesPosition: cached?.subtitlesPosition ?? subtitlesPosition,
        subtitlesBackground: cached?.subtitlesBackground ?? subtitlesBackground,
        subtitlesKaraoke: cached?.subtitlesKaraoke ?? subtitlesKaraoke,
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
          sharesCount: existingEngagementCache?.sharesCount ?? sharesCount,
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
          sharesCount: existingEngagementCache?.sharesCount ?? sharesCount,
          fetchedAt: Date.now(),
        });
        toast.success('Saved to watch later!');
      }
    } catch (error) {
      toast.error('Failed to save video');
    }
  };

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic('light');

    const shareUrl = `${window.location.origin}/profile/${video.creator_id}`;
    const shareData = {
      title: video.title || 'DiskieReels',
      text: video.description || video.title || 'Watch this reel on DiskieReels',
      url: shareUrl,
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        toast.success('Share link copied');
      } else {
        toast.success('Share link ready');
      }

      if (currentUserId) {
        setSharesCount(prev => prev + 1);
        const existingEngagementCache = videoEngagementCache.get(video.id);
        videoEngagementCache.set(video.id, {
          commentsCount: existingEngagementCache?.commentsCount ?? commentsCount,
          savesCount: existingEngagementCache?.savesCount ?? savesCount,
          sharesCount: (existingEngagementCache?.sharesCount ?? sharesCount) + 1,
          fetchedAt: Date.now(),
        });

        const { error } = await supabase
          .from('video_shares')
          .insert({ video_id: video.id, user_id: currentUserId, share_target: navigator.share ? 'native' : 'copy_link' });

        if (error) {
          setSharesCount(prev => Math.max(0, prev - 1));
          throw error;
        }
      }

      onPositiveAction?.();
    } catch (error: any) {
      if (error?.name !== 'AbortError') {
        toast.error('Failed to share reel');
      }
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
        setDownloadStage('Adding DiskieReels watermark...');
        
        // Apply watermark client-side using Canvas API with cancellation support
        const controller = addWatermarkToVideo(
          videoBlob, 
          data.creator_username || 'DiskieReels',
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
      link.download = `${data.title || video.title}_DiskieReels.${fileExtension}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      // Haptic feedback and sound on successful download
      triggerHaptic('heavy');
      playSuccessSound();
      
      toast.success(skipWatermark ? 'Downloaded successfully!' : 'Downloaded with DiskieReels watermark!');
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

      // Stop playback first so the player tears down cleanly even mid-play
      const videoEl = videoRef.current;
      if (videoEl) {
        try {
          userPausedRef.current = true;
          videoEl.pause();
          videoEl.removeAttribute('src');
          videoEl.load();
        } catch {
          // ignore — we're deleting anyway
        }
      }

      // Use edge function to delete row + storage objects atomically.
      // Falls back to direct delete if the function is unavailable.
      const { data: { session } } = await supabase.auth.getSession();
      let deleted = false;
      if (session) {
        try {
          const res = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-video`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({ videoId: video.id }),
            }
          );
          if (res.ok) deleted = true;
          else console.warn('delete-video function failed, falling back', await res.text().catch(() => ''));
        } catch (e) {
          console.warn('delete-video function error, falling back', e);
        }
      }
      if (!deleted) {
        const { error } = await supabase.from('videos').delete().eq('id', video.id);
        if (error) throw error;
      }

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
            src={video.video_url}
            poster={video.thumbnail_url || undefined}
            className="w-full h-full object-contain"
            loop={isLooping}
            muted={isMuted}
            playsInline
            webkit-playsinline="true"
            x5-playsinline="true"
            x5-video-player-type="h5"
            preload={activeVideoPreload}
            autoPlay={isActive && autoplayEnabled}
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
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2 z-10">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-white/30 border-t-white" />
            <span className="text-white/90 text-xs font-medium drop-shadow">Loading…</span>
          </div>
        )}

        {/* Reels auto-play silently — no manual play button is shown. */}
      </div>
      
      {/* Subtitle Display - Draggable */}
      {subtitlesEnabled && currentSubtitle && (
        <div
          ref={subtitleRef}
          className="absolute z-30 flex justify-center px-4 cursor-grab active:cursor-grabbing select-none pointer-events-auto"
          style={{
            ...(subtitlesPosition === 'top'
              ? { top: `calc(80px + ${subtitlePosition.y}px)` }
              : subtitlesPosition === 'middle'
              ? { top: '50%', transform: `translate(calc(-50% + ${subtitlePosition.x}px), -50%)` }
              : { bottom: `calc(env(safe-area-inset-bottom, 0px) + ${Math.max(120, subtitlePosition.y)}px)` }),
            ...(subtitlesPosition !== 'middle' ? { left: '50%', transform: `translateX(calc(-50% + ${subtitlePosition.x}px))` } : {}),
            touchAction: 'none',
          }}
          onMouseDown={handleSubtitleDragStart}
          onTouchStart={handleSubtitleDragStart}
        >
          <div
            className={`rounded-2xl px-5 py-3 max-w-[92%] ${
              subtitlesBackground === 'solid'
                ? 'bg-black/85'
                : subtitlesBackground === 'translucent'
                ? 'bg-black/45 backdrop-blur-md'
                : 'bg-transparent'
            }`}
          >
            <p
              className={`text-white text-center font-extrabold leading-snug tracking-wide ${
                subtitlesSize === 'small'
                  ? 'text-base'
                  : subtitlesSize === 'large'
                  ? 'text-2xl'
                  : subtitlesSize === 'xl'
                  ? 'text-3xl'
                  : 'text-xl'
              }`}
              style={
                subtitlesBackground === 'none'
                  ? { textShadow: '0 0 6px rgba(0,0,0,0.95), 0 2px 4px rgba(0,0,0,0.95), 0 0 2px rgba(0,0,0,1)' }
                  : { textShadow: '0 1px 3px rgba(0,0,0,0.6)' }
              }
            >
              {subtitlesKaraoke && currentSubtitleSeg?.words && currentSubtitleSeg.words.length > 0 ? (
                currentSubtitleSeg.words.map((w, i) => {
                  const active = currentTimeRef.current >= w.start && currentTimeRef.current <= w.end + 0.05;
                  const past = currentTimeRef.current > w.end;
                  return (
                    <span
                      key={i}
                      className={`inline-block transition-colors duration-100 ${
                        active ? 'text-yellow-300 scale-110' : past ? 'text-white' : 'text-white/70'
                      }`}
                      style={{ marginRight: '0.3em' }}
                    >
                      {w.text}
                    </span>
                  );
                })
              ) : (
                currentSubtitle
              )}
            </p>
          </div>
        </div>
      )}
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      
      {/* DiskieReels Branding - Top Left */}
      <div className="absolute top-12 left-3 z-20">
        <span className="text-white/40 text-xl font-bold tracking-wide">DiskieReels</span>
      </div>

      {/* Captions ready badge */}
      {isActive && video.transcription_status === 'completed' && video.subtitles && video.subtitles.length > 0 && subtitlesEnabled && (
        <div className="absolute top-[72px] left-3 z-20 pointer-events-none">
          <div className="flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold bg-primary/70 text-primary-foreground backdrop-blur-md">
            <Subtitles className="h-3 w-3" /> CC
          </div>
        </div>
      )}
      
      {/* Top Controls - aligned with DiskieReels branding */}
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
            {isOwnVideo && (video.transcription_status === 'failed' || (!video.subtitles?.length && video.transcription_status !== 'processing' && video.transcription_status !== 'pending')) && (
              <>
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground border-t mt-1 pt-2">Captions</div>
                <DropdownMenuItem
                  disabled={retryingTranscription}
                  onClick={async () => {
                    setRetryingTranscription(true);
                    try {
                      const { data: { session } } = await supabase.auth.getSession();
                      const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
                        body: JSON.stringify({ videoId: video.id, videoUrl: video.video_url }),
                      });
                      if (!res.ok) throw new Error('Failed');
                      toast.success('Captions are being regenerated');
                    } catch {
                      toast.error('Could not retry captions');
                    } finally {
                      setRetryingTranscription(false);
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <Subtitles className="h-4 w-4" />
                  {retryingTranscription ? 'Retrying…' : 'Retry Captions'}
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
            {video.profiles.is_verified && video.profiles.username === 'DiskieReelsOff' ? (
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

        {/* Views */}
        <div className="flex flex-col items-center">
          <div className="rounded-full h-9 w-9 flex items-center justify-center text-white">
            <Eye className="h-5 w-5" />
          </div>
          <span className="text-[9px] text-white font-medium">{viewsCount}</span>
        </div>

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

        {/* Share */}
        <button
          onClick={handleShare}
          className="flex flex-col items-center"
        >
          <div className="rounded-full h-9 w-9 flex items-center justify-center text-white">
            <Share2 className="h-5 w-5" />
          </div>
          <span className="text-[9px] text-white font-medium">{sharesCount}</span>
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
