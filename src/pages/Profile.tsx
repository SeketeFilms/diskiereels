import { useEffect, useState, useRef } from 'react';
import { useNavigate, useSearchParams, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { LogOut, Settings, Video, Camera, Edit, BarChart3, Bookmark, Eye, Heart, Trash2, BadgeCheck, Flag, ChevronRight } from 'lucide-react';

import SocialLinksDisplay from '@/components/SocialLinksDisplay';
import SocialLinksEditor from '@/components/SocialLinksEditor';
import ResponsiveLayout from '@/components/ResponsiveLayout';
import NotificationBell from '@/components/NotificationBell';
import { toast } from 'sonner';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import ProfileVideoViewer from '@/components/ProfileVideoViewer';
import ProfileSkeleton from '@/components/ProfileSkeleton';
import MilestoneConfetti from '@/components/MilestoneConfetti';
import VerificationRequestDialog from '@/components/VerificationRequestDialog';
import { checkAndTriggerMilestone, MilestoneType } from '@/hooks/useMilestoneTracker';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { z } from 'zod';

interface Profile {
  id?: string;
  username: string;
  user_type: string;
  bio: string;
  avatar_url: string;
  cover_photo_url?: string;
  is_verified?: boolean;
  tiktok_url?: string | null;
  instagram_url?: string | null;
  facebook_url?: string | null;
  youtube_url?: string | null;
  social_links_order?: string[];
  social_links_visible?: string[];
}

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

// Move schema outside component to avoid recreation on every render
const videoEditSchema = z.object({
  title: z.string().trim().min(1, { message: "Title is required" }).max(100, { message: "Title must be less than 100 characters" }),
  description: z.string().trim().max(500, { message: "Description must be less than 500 characters" }).optional()
});

const Profile = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const touchStartXRef = useRef<number>(0);
  const touchStartYRef = useRef<number>(0);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [editingUsername, setEditingUsername] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [editingBio, setEditingBio] = useState(false);
  const [newBio, setNewBio] = useState('');
  const [isOwnProfile, setIsOwnProfile] = useState(true);
  const [followersCount, setFollowersCount] = useState(0);
  const [followingCount, setFollowingCount] = useState(0);
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [selectedVideoIndex, setSelectedVideoIndex] = useState<number | null>(null);
  const [isCreative, setIsCreative] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [savedVideos, setSavedVideos] = useState<Video[]>([]);
  const [editingVideo, setEditingVideo] = useState<Video | null>(null);
  const [editVideoTitle, setEditVideoTitle] = useState('');
  const [editVideoDescription, setEditVideoDescription] = useState('');
  const [deletingVideo, setDeletingVideo] = useState<string | null>(null);
  const [milestoneToShow, setMilestoneToShow] = useState<{ type: MilestoneType; value: number } | null>(null);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [showFollowersList, setShowFollowersList] = useState(false);
  const [followers, setFollowers] = useState<{ id: string; username: string; avatar_url: string | null }[]>([]);
  const [showSocialLinksEditor, setShowSocialLinksEditor] = useState(false);

  // Check for milestones when stats load
  useEffect(() => {
    if (isOwnProfile && followersCount > 0) {
      const milestone = checkAndTriggerMilestone('followers', followersCount);
      if (milestone) {
        setMilestoneToShow({ type: 'followers', value: milestone });
      }
    }
  }, [followersCount, isOwnProfile]);

  useEffect(() => {
    if (isOwnProfile && videos.length > 0) {
      const milestone = checkAndTriggerMilestone('uploads', videos.length);
      if (milestone) {
        setMilestoneToShow({ type: 'uploads', value: milestone });
      }
    }
  }, [videos.length, isOwnProfile]);

  useEffect(() => {
    if (isOwnProfile && totalLikes > 0) {
      const milestone = checkAndTriggerMilestone('likes', totalLikes);
      if (milestone) {
        setMilestoneToShow({ type: 'likes', value: milestone });
      }
    }
  }, [totalLikes, isOwnProfile]);

  useEffect(() => {
    if (isOwnProfile && totalViews > 0) {
      const milestone = checkAndTriggerMilestone('views', totalViews);
      if (milestone) {
        setMilestoneToShow({ type: 'views', value: milestone });
      }
    }
  }, [totalViews, isOwnProfile]);

  // Extract userId from URL params or search params
  const { userId: urlUserId } = useParams<{ userId: string }>();
  const userIdParam = urlUserId || searchParams.get('userId');

  useEffect(() => {
    const loadProfile = async () => {
      // Get session once and reuse
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate('/auth');
        return;
      }
      
      const currentUser = session.user;
      setCurrentUserId(currentUser.id);
      
      // Determine target user
      const targetUserId = userIdParam || currentUser.id;
      const isOwn = !userIdParam || userIdParam === currentUser.id;
      setIsOwnProfile(isOwn);
      
      // Fetch all data in parallel for faster loading
      await Promise.all([
        fetchProfileData(targetUserId),
        fetchUserVideos(targetUserId),
        fetchSavedVideos(targetUserId),
        fetchFollowCounts(targetUserId),
        fetchStatsCounts(targetUserId),
        checkIfCreative(currentUser.id),
        fetchVerificationStatus(isOwn ? currentUser.id : targetUserId),
        !isOwn ? checkIfFollowingUser(currentUser.id, targetUserId) : Promise.resolve()
      ]);
    };
    
    loadProfile();
  }, [userIdParam]);

  const fetchVerificationStatus = async (userId: string) => {
    const { data } = await supabase
      .from('creator_verifications')
      .select('status')
      .eq('user_id', userId)
      .maybeSingle();
    
    setVerificationStatus(data?.status || null);
  };

  const fetchProfileData = async (targetUserId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', targetUserId)
      .maybeSingle();

    if (data) {
      setProfile({ ...data, id: data.id || targetUserId });
      setNewUsername(data.username);
      setNewBio(data.bio || '');
    }
  };

  const checkIfCreative = async (userId: string) => {
    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    setIsCreative(roles?.some(r => r.role === 'creative') || false);
  };

  const checkIfFollowingUser = async (followerId: string, followingId: string) => {
    const { data } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', followerId)
      .eq('following_id', followingId)
      .maybeSingle();
    
    setIsFollowing(!!data);
  };


  const handleFollowToggle = async () => {
    if (!currentUserId || !profile?.id) return;

    try {
      // Check if current user is creative and target is viewer
      const { data: currentUserProfile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', currentUserId)
        .single();

      const { data: targetUserProfile } = await supabase
        .from('profiles')
        .select('user_type')
        .eq('id', profile.id)
        .single();

      // Creatives cannot follow viewers
      if (currentUserProfile?.user_type === 'creative' && targetUserProfile?.user_type === 'viewer') {
        toast.error('Creatives can only follow other creatives');
        return;
      }

      if (isFollowing) {
        await supabase
          .from('follows')
          .delete()
          .eq('follower_id', currentUserId)
          .eq('following_id', profile.id);
        setIsFollowing(false);
        setFollowersCount(prev => prev - 1);
        toast.success('Unfollowed');
      } else {
        await supabase
          .from('follows')
          .insert({
            follower_id: currentUserId,
            following_id: profile.id
          });
        setIsFollowing(true);
        setFollowersCount(prev => prev + 1);
        toast.success('Following!');
      }
    } catch (error) {
      toast.error('Failed to update follow status');
    }
  };

  const fetchFollowCounts = async (targetUserId: string) => {
    if (!targetUserId) return;

    // Get followers and following counts in parallel
    const [followersResult, followingResult] = await Promise.all([
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', targetUserId),
      supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', targetUserId)
    ]);

    setFollowersCount(followersResult.count || 0);
    setFollowingCount(followingResult.count || 0);
  };

  const fetchStatsCounts = async (targetUserId: string) => {
    if (!targetUserId) return;

    // Get profile to check user type
    const { data: profileData } = await supabase
      .from('profiles')
      .select('user_type')
      .eq('id', targetUserId)
      .maybeSingle();

    if (profileData?.user_type === 'creative') {
      const { data: videos } = await supabase
        .from('videos')
        .select('views_count, likes_count')
        .eq('creator_id', targetUserId);

      if (videos) {
        const views = videos.reduce((sum, v) => sum + (v.views_count || 0), 0);
        const likes = videos.reduce((sum, v) => sum + (v.likes_count || 0), 0);
        setTotalViews(views);
        setTotalLikes(likes);
      }
    } else {
      const { data: savedData } = await supabase
        .from('saved_videos')
        .select('videos(views_count, likes_count)')
        .eq('user_id', targetUserId);

      if (savedData) {
        const views = savedData.reduce((sum, item: any) => sum + (item.videos?.views_count || 0), 0);
        const likes = savedData.reduce((sum, item: any) => sum + (item.videos?.likes_count || 0), 0);
        setTotalViews(views);
        setTotalLikes(likes);
      }
    }
  };

  const fetchUserVideos = async (targetUserId: string) => {
    if (!targetUserId) return;

    const { data } = await supabase
      .from('videos')
      .select('*')
      .eq('creator_id', targetUserId)
      .order('created_at', { ascending: false });

    setVideos(data || []);
  };

  const fetchSavedVideos = async (targetUserId: string) => {
    if (!targetUserId) return;

    const { data } = await supabase
      .from('saved_videos')
      .select(`
        video_id,
        videos (
          id,
          title,
          thumbnail_url,
          views_count,
          likes_count,
          video_url,
          description,
          creator_id,
          profiles:creator_id (
            username,
            avatar_url
          )
        )
      `)
      .eq('user_id', targetUserId)
      .order('created_at', { ascending: false });

    if (data) {
      const videos = data.map(item => {
        const video = item.videos as any;
        if (!video) return null;
        return {
          ...video,
          creator_username: video.profiles?.username,
          creator_avatar_url: video.profiles?.avatar_url,
        };
      }).filter(Boolean) as Video[];
      setSavedVideos(videos);
    }
  };

  const fetchFollowers = async (targetUserId: string) => {
    const { data } = await supabase
      .from('follows')
      .select(`
        follower_id,
        profiles:follower_id (
          id,
          username,
          avatar_url
        )
      `)
      .eq('following_id', targetUserId);

    if (data) {
      const followersList = data.map((item: any) => ({
        id: item.profiles?.id || item.follower_id,
        username: item.profiles?.username || 'Unknown',
        avatar_url: item.profiles?.avatar_url || null,
      }));
      setFollowers(followersList);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    toast.success('Signed out successfully');
    navigate('/auth');
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/avatar.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      toast.success('Profile picture updated!');
      fetchProfileData(user.id);
    } catch (error) {
      toast.error('Failed to upload avatar');
    }
  };

  const handleCoverPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/cover.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const cacheBustedUrl = `${publicUrl}?t=${Date.now()}`;

      await supabase
        .from('profiles')
        .update({ cover_photo_url: publicUrl })
        .eq('id', user.id);

      // Instantly update local state so cover photo appears immediately
      setProfile(prev => prev ? { ...prev, cover_photo_url: cacheBustedUrl } : prev);
      toast.success('Cover photo updated!');
    } catch (error) {
      toast.error('Failed to upload cover photo');
    }
  };

  const handleUsernameUpdate = async () => {
    if (!newUsername.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({ username: newUsername })
        .eq('id', user.id);

      toast.success('Username updated!');
      setEditingUsername(false);
      fetchProfileData(user.id);
    } catch (error) {
      toast.error('Failed to update username');
    }
  };

  const handleBioUpdate = async () => {
    if (newBio.length > 50) {
      toast.error('Bio must be 50 characters or less');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from('profiles')
        .update({ bio: newBio.trim() })
        .eq('id', user.id);

      toast.success('Bio updated!');
      setEditingBio(false);
      fetchProfileData(user.id);
    } catch (error) {
      toast.error('Failed to update bio');
    }
  };

  const handleOpenEditVideo = (video: Video) => {
    setEditingVideo(video);
    setEditVideoTitle(video.title);
    setEditVideoDescription(video.description || '');
  };

  const handleCloseEditVideo = () => {
    setEditingVideo(null);
    setEditVideoTitle('');
    setEditVideoDescription('');
  };

  const handleSaveVideoEdit = async () => {
    if (!editingVideo) return;

    const validation = videoEditSchema.safeParse({
      title: editVideoTitle,
      description: editVideoDescription,
    });

    if (!validation.success) {
      toast.error(validation.error.issues[0].message);
      return;
    }

    try {
      const { error } = await supabase
        .from("videos")
        .update({
          title: editVideoTitle,
          description: editVideoDescription,
        })
        .eq("id", editingVideo.id);

      if (error) throw error;

      // Update local state
      setVideos(videos.map(v => 
        v.id === editingVideo.id 
          ? { ...v, title: editVideoTitle, description: editVideoDescription }
          : v
      ));

      toast.success("Video updated successfully!");
      handleCloseEditVideo();
    } catch (error) {
      console.error("Error updating video:", error);
      toast.error("Failed to update video");
    }
  };

  const handleDeleteVideo = async () => {
    if (!deletingVideo) return;

    try {
      const { error } = await supabase
        .from("videos")
        .delete()
        .eq("id", deletingVideo);

      if (error) throw error;

      // Update local state
      setVideos(videos.filter(v => v.id !== deletingVideo));

      toast.success("Video deleted successfully!");
      setDeletingVideo(null);
    } catch (error) {
      console.error("Error deleting video:", error);
      toast.error("Failed to delete video");
    }
  };

  // Swipe right to go back (only when viewing another user's profile)
  const handleSwipeStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
  };

  const handleSwipeEnd = (e: React.TouchEvent) => {
    const deltaX = e.changedTouches[0].clientX - touchStartXRef.current;
    const deltaY = Math.abs(e.changedTouches[0].clientY - touchStartYRef.current);
    
    // Only trigger horizontal swipe if it's more horizontal than vertical
    if (deltaX > 80 && deltaY < 50 && !isOwnProfile) {
      // Swipe right - go back
      navigate(-1);
    }
  };

  if (!profile) return <ProfileSkeleton />;

  return (
    <ResponsiveLayout>
    <>
      {/* Milestone Confetti */}
      {milestoneToShow && (
        <MilestoneConfetti
          milestone={milestoneToShow.value}
          type={milestoneToShow.type}
          onComplete={() => setMilestoneToShow(null)}
        />
      )}
      
      <div 
        className="min-h-screen bg-background pb-20 md:pb-4"
        onTouchStart={handleSwipeStart}
        onTouchEnd={handleSwipeEnd}
      >
        <div className="max-w-2xl mx-auto">
        {/* Header with Cover Photo */}
        <div className="relative bg-gradient-to-br from-primary via-accent to-fun-yellow h-72 md:h-64 rounded-3xl mx-4 mt-4 overflow-hidden">
          {/* Cover Photo - fills the entire header with gradient overlay */}
          {profile?.cover_photo_url && (
            <>
              <img 
                src={`${profile.cover_photo_url}?t=${Date.now()}`}
                alt="Cover" 
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/20" />
            </>
          )}

          {/* Cover Photo Upload Area - Make entire area clickable if own profile */}
          {isOwnProfile && (
            <>
              <label
                htmlFor="cover-upload"
                className="absolute inset-0 cursor-pointer group"
                title="Click to change cover photo"
              >
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                  <div className="bg-background/90 backdrop-blur-sm text-foreground rounded-full p-3 opacity-0 group-hover:opacity-100 transition-opacity shadow-lg">
                    <Camera className="h-6 w-6" />
                  </div>
                </div>
              </label>
              <input
                id="cover-upload"
                type="file"
                accept="image/*"
                onChange={handleCoverPhotoUpload}
                className="hidden"
              />
            </>
          )}

          {/* Settings and Sign Out Buttons / Follow Button */}
          <div className="relative flex justify-end gap-2 p-4 z-10">
            {isOwnProfile ? (
              /* Own profile buttons - hidden on desktop (in sidebar More menu) */
              <div className="flex gap-2 md:hidden">
                <NotificationBell />
                {isCreative && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="rounded-full"
                    onClick={() => navigate('/toonly-studio')}
                    title="ToonlyStudio"
                  >
                    <BarChart3 className="h-5 w-5" />
                  </Button>
                )}
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full"
                  onClick={() => navigate('/settings')}
                >
                  <Settings className="h-5 w-5" />
                </Button>
                <Button
                  variant="secondary"
                  size="icon"
                  onClick={handleSignOut}
                  className="rounded-full"
                >
                  <LogOut className="h-5 w-5" />
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                {/* Report unverified creator button */}
                {profile.user_type === 'creative' && !profile.is_verified && (
                  <Button
                    variant="secondary"
                    size="icon"
                    className="rounded-full"
                    onClick={() => {
                      toast.info('Report feature coming soon. Unverified creators should be reported if content is inappropriate.');
                    }}
                    title="Report unverified creator"
                  >
                    <Flag className="h-5 w-5 text-orange-500" />
                  </Button>
                )}
                <Button
                  onClick={handleFollowToggle}
                  variant={isFollowing ? "outline" : "default"}
                  className="rounded-full"
                >
                  {isFollowing ? 'Unfollow' : 'Follow'}
                </Button>
              </div>
            )}
          </div>

          {/* Profile Info - Responsive Layout */}
          <div className="relative px-4 md:px-8 pt-4 z-10">
            {/* Profile Section */}
            <div className="flex items-center gap-3 mb-4">
              <div className="relative">
                <Avatar className="h-16 w-16 md:h-20 md:w-20 border-4 border-background shadow-lg">
                  <AvatarImage src={profile.avatar_url || undefined} alt={profile.username} />
                  <AvatarFallback className="bg-primary text-primary-foreground font-black text-2xl md:text-3xl">
                    {profile.username[0].toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                {isOwnProfile && (
                  <label
                    htmlFor="avatar-upload"
                    className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-1.5 cursor-pointer hover:scale-110 transition-transform shadow-lg"
                  >
                    <Camera className="h-3 w-3" />
                    <input
                      id="avatar-upload"
                      type="file"
                      accept="image/*"
                      onChange={handleAvatarUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              
              <div className="flex-1 text-left">
                {editingUsername && isOwnProfile ? (
                  <div className="flex items-center gap-2 mb-1">
                    <Input
                      value={newUsername}
                      onChange={(e) => setNewUsername(e.target.value)}
                      className="max-w-xs text-white font-black"
                      placeholder="New username"
                    />
                    <Button size="sm" onClick={handleUsernameUpdate}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingUsername(false)}>Cancel</Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 mb-1">
                    <h1 className="text-xl md:text-2xl font-black text-white drop-shadow-lg">
                      {profile.username}
                    </h1>
                    {/* Verification Badge - special for ToonReelsOff */}
                    {profile.user_type === 'creative' && profile.is_verified && profile.username === 'ToonReelsOff' && (
                      <span className="text-yellow-400 text-xl drop-shadow-[0_0_1px_rgba(0,0,0,1)] [text-shadow:_-1px_-1px_0_#000,_1px_-1px_0_#000,_-1px_1px_0_#000,_1px_1px_0_#000]">
                        ⭐
                      </span>
                    )}
                    {profile.user_type === 'creative' && profile.is_verified && profile.username !== 'ToonReelsOff' && (
                      <BadgeCheck className="h-5 w-5 text-blue-500 drop-shadow-lg" fill="white" />
                    )}
                    {isOwnProfile && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-white"
                        onClick={() => {
                          setNewUsername(profile.username);
                          setEditingUsername(true);
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <p className="text-white/90 drop-shadow-lg font-semibold capitalize text-xs md:text-sm">
                    {profile.user_type}
                  </p>
                  {/* Verification status for own profile */}
                  {isOwnProfile && profile.user_type === 'creative' && !profile.is_verified && (
                    <Button
                      size="sm"
                      variant="secondary"
                      className="h-6 text-xs rounded-full"
                      onClick={() => setShowVerificationDialog(true)}
                      disabled={verificationStatus === 'pending'}
                    >
                      {verificationStatus === 'pending' ? 'Pending Review' : 'Get Verified'}
                    </Button>
                  )}
                  {profile.user_type === 'creative' && !profile.is_verified && !isOwnProfile && (
                    <span className="text-orange-400 text-xs font-medium drop-shadow-lg">
                      ⚠️ Unverified
                    </span>
                  )}
                </div>
                
                {/* Bio Section */}
                {editingBio && isOwnProfile ? (
                  <div className="mt-2 flex items-start gap-2">
                    <div className="relative flex-1">
                      <textarea
                        value={newBio}
                        onChange={(e) => setNewBio(e.target.value)}
                        maxLength={50}
                        placeholder="Add a bio..."
                        className="w-full max-w-xs text-white bg-black/30 backdrop-blur-sm rounded-lg p-2 text-xs resize-none border border-white/20 focus:border-white/40 outline-none"
                        rows={2}
                      />
                      <span className="text-[10px] text-white/60 absolute bottom-1 right-2">
                        {newBio.length}/50
                      </span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" onClick={handleBioUpdate} className="h-6 text-[10px] px-2">
                        Save
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => {
                          setEditingBio(false);
                          setNewBio(profile.bio || '');
                        }}
                        className="h-6 text-[10px] px-2 text-white"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 mt-1">
                    {profile.bio ? (
                      <p className="text-white/80 drop-shadow-md text-xs flex-1">
                        {profile.bio}
                      </p>
                    ) : isOwnProfile ? (
                      <p className="text-white/60 drop-shadow-md text-xs italic flex-1">
                        No bio yet
                      </p>
                    ) : null}
                    {isOwnProfile && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-5 w-5 text-white/80 hover:text-white shrink-0"
                        onClick={() => {
                          setNewBio(profile.bio || '');
                          setEditingBio(true);
                        }}
                      >
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                )}

                {/* Social Links - Show for creatives */}
                {profile.user_type === 'creative' && (
                  <div className="flex items-center gap-2 mt-2">
                    <SocialLinksDisplay
                      tiktokUrl={profile.tiktok_url}
                      instagramUrl={profile.instagram_url}
                      facebookUrl={profile.facebook_url}
                      youtubeUrl={profile.youtube_url}
                      linksOrder={profile.social_links_order}
                      linksVisible={profile.social_links_visible}
                    />
                    {isOwnProfile && (
                      <Button
                        size="sm"
                        variant="secondary"
                        className="h-6 text-[10px] rounded-full px-2"
                        onClick={() => setShowSocialLinksEditor(true)}
                      >
                        {(profile.tiktok_url || profile.instagram_url || profile.facebook_url || profile.youtube_url) ? 'Edit' : '+ Links'}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Stats Row - Conditional based on user type */}
            {profile.user_type === 'creative' ? (
              // Creative users: Show all stats (Views, Likes, Followers, Videos)
              <div className="flex items-center justify-around gap-2 px-2">
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-lg md:text-xl font-black text-white drop-shadow-lg">
                    {totalViews}
                  </p>
                  <p className="text-[10px] md:text-xs text-white/90 drop-shadow-md font-semibold">Views</p>
                </div>
                <div className="h-8 w-px bg-white/20"></div>
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-lg md:text-xl font-black text-white drop-shadow-lg">
                    {totalLikes}
                  </p>
                  <p className="text-[10px] md:text-xs text-white/90 drop-shadow-md font-semibold">Likes</p>
                </div>
                <div className="h-8 w-px bg-white/20"></div>
                <button 
                  className="flex flex-col items-center min-w-0 hover:opacity-80 transition-opacity"
                  onClick={() => {
                    if (isOwnProfile) {
                      fetchFollowers(profile.id || currentUserId);
                      setShowFollowersList(true);
                    }
                  }}
                >
                  <p className="text-lg md:text-xl font-black text-white drop-shadow-lg">{followersCount}</p>
                  <p className="text-[10px] md:text-xs text-white/90 drop-shadow-md font-semibold">Followers</p>
                </button>
                <div className="h-8 w-px bg-white/20"></div>
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-lg md:text-xl font-black text-white drop-shadow-lg">{videos.length}</p>
                  <p className="text-[10px] md:text-xs text-white/90 drop-shadow-md font-semibold">Videos</p>
                </div>
              </div>
            ) : (
              // Viewer users: Show only Followers and Following
              <div className="flex items-center justify-center gap-4 px-2">
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-lg md:text-xl font-black text-white drop-shadow-lg">{followersCount}</p>
                  <p className="text-[10px] md:text-xs text-white/90 drop-shadow-md font-semibold">Followers</p>
                </div>
                <div className="h-8 w-px bg-white/20"></div>
                <div className="flex flex-col items-center min-w-0">
                  <p className="text-lg md:text-xl font-black text-white drop-shadow-lg">{followingCount}</p>
                  <p className="text-[10px] md:text-xs text-white/90 drop-shadow-md font-semibold">Following</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick-access Studio Stats Card for creators (mobile) */}
        {isOwnProfile && isCreative && (
          <div className="px-4 pt-3 md:hidden">
            <button
              onClick={() => navigate('/toonly-studio')}
              className="w-full bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 border border-primary/20 rounded-2xl p-3 hover:border-primary/40 transition-all"
            >
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold">ToonlyStudio</span>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div className="text-center">
                  <p className="text-sm font-black">{totalViews}</p>
                  <p className="text-[9px] text-muted-foreground">Views</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black">{totalLikes}</p>
                  <p className="text-[9px] text-muted-foreground">Likes</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black">{followersCount}</p>
                  <p className="text-[9px] text-muted-foreground">Followers</p>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black">{videos.length}</p>
                  <p className="text-[9px] text-muted-foreground">Toonz</p>
                </div>
              </div>
            </button>
          </div>
        )}

        {/* Videos Grid */}
        {profile.user_type === 'creative' && (
          <div className="p-4">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <Video className="h-6 w-6 text-primary" />
              My Animations
            </h2>
            
            {videos.length === 0 ? (
              <Card className="p-12 text-center">
                <Video className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No videos yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Start creating amazing animations!
                </p>
                <Button
                  onClick={() => navigate('/upload')}
                  className="mt-4"
                >
                  Upload Your First Video
                </Button>
              </Card>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {videos.map((video, index) => (
                  <div key={video.id} className="relative group">
                    <div
                      onClick={() => setSelectedVideoIndex(index)}
                      className="aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer hover:scale-105 transition-transform relative"
                    >
                      {/* Video Thumbnail/Cover Photo */}
                      {video.thumbnail_url ? (
                        <img 
                          src={video.thumbnail_url} 
                          alt={video.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.querySelector('.fallback-gradient')?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/20 to-fun-blue/20 fallback-gradient ${video.thumbnail_url ? 'hidden' : ''}`} />
                      
                      {/* Gradient overlay for text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      
                      {/* View Count - TikTok style */}
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                        <Eye className="h-3 w-3 text-white" />
                        <span className="text-white text-[10px] font-semibold">
                          {video.views_count || 0}
                        </span>
                      </div>
                      
                      {/* Likes Count - TikTok style */}
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                        <Heart className="h-3 w-3 text-white fill-white" />
                        <span className="text-white text-[10px] font-semibold">
                          {video.likes_count || 0}
                        </span>
                      </div>
                      
                      {/* Video Title */}
                      <div className="absolute top-2 left-2 right-2">
                        <p className="text-white text-xs font-bold drop-shadow-lg line-clamp-2 bg-black/30 backdrop-blur-sm px-2 py-1 rounded">
                          {video.title}
                        </p>
                      </div>
                    </div>
                    {/* Action buttons for own videos */}
                    {isOwnProfile && (
                      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEditVideo(video);
                          }}
                          className="h-7 w-7 p-0"
                          title="Edit video"
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/video-analytics/${video.id}`);
                          }}
                          className="h-7 px-2 text-xs"
                        >
                          Stats
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingVideo(video.id);
                          }}
                          className="h-7 w-7 p-0"
                          title="Delete video"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Saved Videos for Viewers */}
        {profile.user_type === 'viewer' && isOwnProfile && (
          <div className="p-4">
            <h2 className="text-xl font-black mb-4 flex items-center gap-2">
              <Bookmark className="h-6 w-6 text-primary" />
              Saved Reels
            </h2>
            
            {savedVideos.length === 0 ? (
              <Card className="p-12 text-center">
                <Bookmark className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No saved videos yet</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Save videos to watch them later!
                </p>
              </Card>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {savedVideos.map((video, index) => (
                  <div key={video.id} className="relative group">
                    <div
                      onClick={() => setSelectedVideoIndex(index)}
                      className="aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer hover:scale-105 transition-transform relative"
                    >
                      {/* Video Thumbnail/Cover Photo */}
                      {video.thumbnail_url ? (
                        <img 
                          src={video.thumbnail_url} 
                          alt={video.title}
                          className="absolute inset-0 w-full h-full object-cover"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.querySelector('.fallback-gradient')?.classList.remove('hidden');
                          }}
                        />
                      ) : null}
                      <div className={`absolute inset-0 bg-gradient-to-br from-primary/20 via-accent/20 to-fun-blue/20 fallback-gradient ${video.thumbnail_url ? 'hidden' : ''}`} />
                      
                      {/* Gradient overlay for text readability */}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      
                      {/* Creator attribution - shows who made this reel, clickable to go to profile */}
                      <div 
                        className="absolute top-2 left-2 right-2 cursor-pointer"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (video.creator_id) {
                            navigate(`/profile?userId=${video.creator_id}`);
                          }
                        }}
                      >
                        <div className="bg-black/50 backdrop-blur-sm px-2 py-1 rounded text-white hover:bg-black/70 transition-colors">
                          <p className="text-[10px] font-semibold truncate">
                            By: {video.creator_username || 'Unknown Creator'} →
                          </p>
                          <p className="text-[8px] text-white/70 truncate">
                            Saved by {profile.username}
                          </p>
                        </div>
                      </div>
                      
                      {/* View Count - TikTok style */}
                      <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                        <Eye className="h-3 w-3 text-white" />
                        <span className="text-white text-[10px] font-semibold">
                          {video.views_count || 0}
                        </span>
                      </div>
                      
                      {/* Likes Count - TikTok style */}
                      <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-full">
                        <Heart className="h-3 w-3 text-white fill-white" />
                        <span className="text-white text-[10px] font-semibold">
                          {video.likes_count || 0}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Video Viewer Modal */}
      {selectedVideoIndex !== null && (
        <ProfileVideoViewer
          videos={profile.user_type === 'creative' ? videos : savedVideos}
          initialIndex={selectedVideoIndex}
          profile={profile}
          currentUserId={currentUserId || ''}
          onClose={() => setSelectedVideoIndex(null)}
          onDelete={(videoId) => {
            setSelectedVideoIndex(null);
            setVideos(videos.filter(v => v.id !== videoId));
          }}
        />
      )}


      {/* Edit Video Dialog */}
      <Dialog open={!!editingVideo} onOpenChange={(open) => !open && handleCloseEditVideo()}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Edit Video</DialogTitle>
            <DialogDescription>
              Update your video title and description
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="video-title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="video-title"
                value={editVideoTitle}
                onChange={(e) => setEditVideoTitle(e.target.value)}
                placeholder="Enter video title"
                maxLength={100}
              />
              <p className="text-xs text-muted-foreground">
                {editVideoTitle.length}/100 characters
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="video-description">Description</Label>
              <Textarea
                id="video-description"
                value={editVideoDescription}
                onChange={(e) => setEditVideoDescription(e.target.value)}
                placeholder="Enter video description (optional)"
                maxLength={500}
                rows={4}
              />
              <p className="text-xs text-muted-foreground">
                {editVideoDescription.length}/500 characters
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseEditVideo}>
              Cancel
            </Button>
            <Button onClick={handleSaveVideoEdit}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Video Confirmation Dialog */}
      <AlertDialog open={!!deletingVideo} onOpenChange={(open) => !open && setDeletingVideo(null)}>
        <AlertDialogContent>
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

      {/* Verification Request Dialog */}
      <VerificationRequestDialog
        open={showVerificationDialog}
        onOpenChange={setShowVerificationDialog}
        onSuccess={() => setVerificationStatus('pending')}
      />

      {/* Followers List Dialog */}
      <Dialog open={showFollowersList} onOpenChange={setShowFollowersList}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Your Followers</DialogTitle>
            <DialogDescription>
              People who follow you ({followersCount})
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto space-y-2">
            {followers.length === 0 ? (
              <p className="text-center text-muted-foreground py-8">No followers yet</p>
            ) : (
              followers.map((follower) => (
                <div
                  key={follower.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={follower.avatar_url || undefined} />
                    <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                      {follower.username[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <span className="font-medium text-sm">{follower.username}</span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Social Links Editor Dialog */}
      <Dialog open={showSocialLinksEditor} onOpenChange={setShowSocialLinksEditor}>
        <DialogContent className="sm:max-w-[425px]">
          <SocialLinksEditor
            userId={currentUserId}
            tiktokUrl={profile.tiktok_url}
            instagramUrl={profile.instagram_url}
            facebookUrl={profile.facebook_url}
            youtubeUrl={profile.youtube_url}
            linksOrder={profile.social_links_order}
            linksVisible={profile.social_links_visible}
            onSave={() => {
              setShowSocialLinksEditor(false);
              fetchProfileData(currentUserId);
            }}
            onClose={() => setShowSocialLinksEditor(false)}
          />
        </DialogContent>
      </Dialog>

      {/* ToonlyAI is now global - rendered in App.tsx */}

      </div>
    </>
    </ResponsiveLayout>
  );
};

export default Profile;
