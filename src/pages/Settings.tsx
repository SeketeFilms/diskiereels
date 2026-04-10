import { useNavigate } from "react-router-dom";
import { ArrowLeft, Moon, Sun, RefreshCw, ChevronDown, Trash2, UserX, Eye, EyeOff, Mail } from "lucide-react";
import { usePWAUpdate } from "@/hooks/usePWAUpdate";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import ResponsiveLayout from "@/components/ResponsiveLayout";
import { useTheme } from "@/contexts/ThemeContext";
import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const Settings = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { updateAvailable, checking, clearing, checkForUpdates, applyUpdate, clearCacheAndReload } = usePWAUpdate();
  
  const [username, setUsername] = useState("");
  const [selectedAvatar, setSelectedAvatar] = useState("🦊");
  const [ageRange, setAgeRange] = useState("7-9");
  const [profilePin, setProfilePin] = useState("");
  const [cartoonOnlyMode, setCartoonOnlyMode] = useState(true);
  const [contentCategories, setContentCategories] = useState<string[]>(["comedy", "adventure", "learning", "music"]);
  const [commentsVisibility, setCommentsVisibility] = useState("emoji_only");
  const [interactionLimits, setInteractionLimits] = useState(true);
  const [screenTimeLimit, setScreenTimeLimit] = useState(60);
  const [screenTimeEnabled, setScreenTimeEnabled] = useState(true);
  const [schoolHoursLock, setSchoolHoursLock] = useState(false);
  const [bedtimeLock, setBedtimeLock] = useState(false);
  const [profilePinEnabled, setProfilePinEnabled] = useState(true);
  const [parentalPin, setParentalPin] = useState("");
  const [autoplay, setAutoplay] = useState(true);
  const [videoQuality, setVideoQuality] = useState("auto");
  const [subtitlesEnabled, setSubtitlesEnabled] = useState(false);
  const [subtitlesSize, setSubtitlesSize] = useState("medium");
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [totalViews, setTotalViews] = useState(0);
  const [totalLikes, setTotalLikes] = useState(0);
  const [followersCount, setFollowersCount] = useState(0);
  const [videosCount, setVideosCount] = useState(0);
  const [notifLikes, setNotifLikes] = useState(true);
  const [notifComments, setNotifComments] = useState(true);
  const [notifFollows, setNotifFollows] = useState(true);
  const [notifReplies, setNotifReplies] = useState(true);
  const [notifNewVideos, setNotifNewVideos] = useState(true);
  const [notifPush, setNotifPush] = useState(false);
  const [notifSound, setNotifSound] = useState(true);
  const [isCreative, setIsCreative] = useState(false);
  const [userType, setUserType] = useState<string>('viewer');
  const [hasChangedType, setHasChangedType] = useState(false);
  const [showTypeChangeDialog, setShowTypeChangeDialog] = useState(false);
  const [pendingTypeChange, setPendingTypeChange] = useState<string | null>(null);
  const [blockedUsers, setBlockedUsers] = useState<{ id: string; blocked_id: string; username: string; avatar: string }[]>([]);
  const [showProfilePin, setShowProfilePin] = useState(false);
  const [showParentalPin, setShowParentalPin] = useState(false);
  const [resettingProfilePin, setResettingProfilePin] = useState(false);
  const [resettingParentalPin, setResettingParentalPin] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showGoodbyeMessage, setShowGoodbyeMessage] = useState(false);

  // Collapsible section states
  const [openSections, setOpenSections] = useState<string[]>([]);

  const toggleSection = (section: string) => {
    setOpenSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section)
        : [...prev, section]
    );
  };

  useEffect(() => {
    fetchUserSettings();
  }, []);

  const fetchUserSettings = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      
      // Check if user is creative
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      setIsCreative(roles?.some(r => r.role === 'creative') || false);
      
      const { data: profile } = await supabase.from('profiles').select('username, selected_avatar, age_range, user_type').eq('id', user.id).single();
      if (profile) {
        setUsername(profile.username || "");
        setSelectedAvatar(profile.selected_avatar || "🦊");
        setAgeRange(profile.age_range || "7-9");
        setUserType(profile.user_type || 'viewer');
      }
      
      // Check if user has already changed their type
      const { data: typeChange } = await supabase
        .from('user_type_changes')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();
      setHasChangedType(!!typeChange);
      
      // Fetch profile PIN from secure table
      const { data: profileSecrets } = await supabase.from('profile_secrets').select('profile_pin').eq('user_id', user.id).single();
      if (profileSecrets) {
        setProfilePin(profileSecrets.profile_pin || "");
      }
      
      const { data: contentSettings } = await supabase.from('content_settings').select('*').eq('user_id', user.id).single();
      if (contentSettings) {
        setCartoonOnlyMode(contentSettings.cartoon_only_mode);
        setContentCategories(contentSettings.content_categories || []);
        setCommentsVisibility(contentSettings.comments_visibility);
        setInteractionLimits(contentSettings.interaction_limits);
      }
      
      const { data: parentalControls } = await supabase.from('parental_controls').select('*').eq('user_id', user.id).single();
      if (parentalControls) {
        setScreenTimeLimit(parentalControls.screen_time_limit || 60);
        setScreenTimeEnabled(parentalControls.screen_time_enabled !== false);
        setSchoolHoursLock(parentalControls.school_hours_lock || false);
        setBedtimeLock(parentalControls.bedtime_lock || false);
        setParentalPin(parentalControls.parental_pin || "");
        setProfilePinEnabled(parentalControls.profile_pin_enabled !== false);
      }
      
      const { data: playbackSettings } = await supabase.from('playback_settings').select('*').eq('user_id', user.id).single();
      if (playbackSettings) {
        setAutoplay(playbackSettings.autoplay);
        setVideoQuality(playbackSettings.video_quality);
        setSubtitlesEnabled(playbackSettings.subtitles_enabled);
        setSubtitlesSize(playbackSettings.subtitles_size);
      }

      const { data: notifPrefs } = await supabase.from('notification_preferences').select('*').eq('user_id', user.id).single();
      if (notifPrefs) {
        setNotifLikes(notifPrefs.likes_enabled);
        setNotifComments(notifPrefs.comments_enabled);
        setNotifFollows(notifPrefs.follows_enabled);
        setNotifReplies(notifPrefs.replies_enabled);
        setNotifNewVideos((notifPrefs as any).new_videos_enabled !== false);
        setNotifPush(notifPrefs.push_enabled);
        setNotifSound(notifPrefs.sound_enabled);
      }
      
      // Fetch user stats
      const { data: videos } = await supabase.from('videos').select('views_count, likes_count').eq('creator_id', user.id);
      if (videos) {
        const views = videos.reduce((sum, v) => sum + v.views_count, 0);
        const likes = videos.reduce((sum, v) => sum + v.likes_count, 0);
        setTotalViews(views);
        setTotalLikes(likes);
        setVideosCount(videos.length);
      }

      const { count: followers } = await supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', user.id);
      setFollowersCount(followers || 0);
      
      // Fetch blocked users
      const { data: blocks } = await supabase
        .from('blocks')
        .select('id, blocked_id')
        .eq('blocker_id', user.id);
      
      if (blocks && blocks.length > 0) {
        const blockedIds = blocks.map(b => b.blocked_id);
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, username, selected_avatar')
          .in('id', blockedIds);
        
        const blockedWithProfiles = blocks.map(b => {
          const profile = profiles?.find(p => p.id === b.blocked_id);
          return {
            id: b.id,
            blocked_id: b.blocked_id,
            username: profile?.username || 'Unknown',
            avatar: profile?.selected_avatar || '🦊'
          };
        });
        setBlockedUsers(blockedWithProfiles);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Error:', error);
      setLoading(false);
    }
  };

  const saveProfileSettings = async () => {
    if (!userId) return;
    try {
      const updates: any = { username, selected_avatar: selectedAvatar, age_range: ageRange };
      
      await supabase.from('profiles').update(updates).eq('id', userId);
      
      // Save PIN using server-side hashing
      if (profilePin && profilePin.trim()) {
        const { error } = await supabase.rpc('set_profile_pin', {
          _user_id: userId,
          _raw_pin: profilePin.trim()
        });
        if (error) throw error;
      }
      
      toast.success('Profile settings saved');
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const saveContentSettings = async () => {
    if (!userId) return;
    try {
      await supabase.from('content_settings').upsert({ user_id: userId, cartoon_only_mode: cartoonOnlyMode, content_categories: contentCategories, comments_visibility: commentsVisibility, interaction_limits: interactionLimits });
      toast.success('Content settings saved');
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const saveParentalControls = async () => {
    if (!userId) return;
    try {
      // First check if parental_controls record exists
      const { data: existingControls } = await supabase
        .from('parental_controls')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      const updates = { 
        user_id: userId, 
        screen_time_limit: screenTimeLimit, 
        screen_time_enabled: screenTimeEnabled,
        school_hours_lock: schoolHoursLock, 
        bedtime_lock: bedtimeLock,
        profile_pin_enabled: profilePinEnabled
      };
      
      if (existingControls) {
        // Update existing record
        await supabase.from('parental_controls').update(updates).eq('user_id', userId);
      } else {
        // Insert new record for new users
        await supabase.from('parental_controls').insert(updates);
      }
      
      // Save Parental PIN using server-side hashing if provided
      if (parentalPin && parentalPin.trim() && parentalPin.length === 4) {
        const { error } = await supabase.rpc('set_parental_pin', {
          _user_id: userId,
          _raw_pin: parentalPin.trim()
        });
        if (error) throw error;
      }
      
      // Save Profile PIN using server-side hashing if provided
      if (profilePin && profilePin.trim() && profilePin.length === 4) {
        const { error } = await supabase.rpc('set_profile_pin', {
          _user_id: userId,
          _raw_pin: profilePin.trim()
        });
        if (error) throw error;
      }
      
      toast.success('Parental controls saved');
    } catch (error) {
      console.error('Save parental controls error:', error);
      toast.error('Failed to save parental controls');
    }
  };

  const savePlaybackSettings = async () => {
    if (!userId) return;
    try {
      await supabase.from('playback_settings').upsert({ user_id: userId, autoplay, video_quality: videoQuality, subtitles_enabled: subtitlesEnabled, subtitles_size: subtitlesSize });
      toast.success('Playback settings saved');
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const saveNotificationSettings = async () => {
    if (!userId) return;
    try {
      await supabase.from('notification_preferences').upsert({ 
        user_id: userId, 
        likes_enabled: notifLikes,
        comments_enabled: notifComments,
        follows_enabled: notifFollows,
        replies_enabled: notifReplies,
        new_videos_enabled: notifNewVideos,
        push_enabled: notifPush,
        sound_enabled: notifSound
      });
      toast.success('Notification settings saved');
      
      // Request push notification permission if enabled
      if (notifPush && 'Notification' in window && Notification.permission === 'default') {
        await Notification.requestPermission();
      }
    } catch (error) {
      toast.error('Failed to save');
    }
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== "DELETE") {
      toast.error("Please type DELETE to confirm");
      return;
    }
    
    try {
      const deleteToast = toast.loading("Deleting account...");
      
      // Call the edge function to delete all user data
      const { data, error } = await supabase.functions.invoke('delete-account');
      
      if (error) {
        toast.error("Failed to delete account", { id: deleteToast });
        throw error;
      }

      toast.success("Account deleted successfully", { id: deleteToast });
      setShowDeleteDialog(false);
      
      // Show goodbye message before redirecting
      setShowGoodbyeMessage(true);
      
      // Wait 3 seconds then sign out and redirect
      setTimeout(async () => {
        await supabase.auth.signOut();
        navigate('/auth');
      }, 3000);
    } catch (error: any) {
      console.error('Delete account error:', error);
      toast.error(error.message || "Failed to delete account");
    }
  };

  const handleUnblock = async (blockId: string) => {
    try {
      await supabase.from('blocks').delete().eq('id', blockId);
      setBlockedUsers(prev => prev.filter(b => b.id !== blockId));
      toast.success('User unblocked');
    } catch (error) {
      toast.error('Failed to unblock user');
    }
  };

  const handleResetPin = async (pinType: "profile" | "parental") => {
    const setResetting = pinType === "profile" ? setResettingProfilePin : setResettingParentalPin;
    setResetting(true);
    
    try {
      const { data, error } = await supabase.functions.invoke('reset-pin', {
        body: { pinType }
      });
      
      if (error) throw error;
      
      toast.success(`${pinType === "profile" ? "Profile" : "Parental"} PIN has been reset and sent to your email!`);
      
      // Clear the local PIN state
      if (pinType === "profile") {
        setProfilePin("");
      } else {
        setParentalPin("");
      }
    } catch (error: any) {
      console.error('Reset PIN error:', error);
      toast.error(`Failed to reset PIN: ${error.message || "Please try again"}`);
    } finally {
      setResetting(false);
    }
  };

  const handleAccountTypeChange = async () => {
    if (!userId || !pendingTypeChange) return;
    
    try {
      const newType = pendingTypeChange as 'viewer' | 'creative';
      const oldType = userType;
      
      // Record the change (this can only happen once due to UNIQUE constraint)
      const { error: changeError } = await supabase
        .from('user_type_changes')
        .insert({
          user_id: userId,
          original_type: oldType,
          new_type: newType
        });
      
      if (changeError) {
        if (changeError.code === '23505') { // Unique violation
          toast.error('You have already used your one-time account type change');
        } else {
          throw changeError;
        }
        return;
      }
      
      // Update profile
      await supabase
        .from('profiles')
        .update({ user_type: newType })
        .eq('id', userId);
      
      // Update or remove user role
      if (newType === 'creative') {
        await supabase
          .from('user_roles')
          .upsert({ user_id: userId, role: 'creative' }, { onConflict: 'user_id,role' });
      } else {
        await supabase
          .from('user_roles')
          .delete()
          .eq('user_id', userId)
          .eq('role', 'creative');
      }
      
      setUserType(newType);
      setIsCreative(newType === 'creative');
      setHasChangedType(true);
      setShowTypeChangeDialog(false);
      setPendingTypeChange(null);
      
      toast.success(`Account type changed to ${newType === 'creative' ? 'Creative' : 'Viewer'}. This cannot be undone.`);
    } catch (error) {
      console.error('Account type change error:', error);
      toast.error('Failed to change account type');
    }
  };

  // Collapsible section header component
  const SectionHeader = ({ title, section }: { title: string; section: string }) => (
    <CollapsibleTrigger 
      onClick={() => toggleSection(section)}
      className="flex items-center justify-between w-full p-3 bg-primary/10 rounded-xl border border-primary/30 hover:bg-primary/20 transition-colors"
    >
      <span className="font-bold text-sm text-primary">{title}</span>
      <ChevronDown 
        className={`h-4 w-4 text-primary transition-transform duration-200 ${
          openSections.includes(section) ? 'rotate-180' : ''
        }`} 
      />
    </CollapsibleTrigger>
  );

  if (loading) return <div className="min-h-screen bg-background flex items-center justify-center"><p>Loading...</p></div>;

  return (
    <ResponsiveLayout>
    <div className="min-h-screen bg-background pb-24 md:pb-4">
      <div className="max-w-4xl mx-auto p-4">
        <div className="mb-4 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/profile')} className="rounded-full"><ArrowLeft className="h-5 w-5" /></Button>
          <h1 className="text-xl font-black">Settings</h1>
        </div>

        <div className="space-y-2">
          {/* Account & Profile */}
          <Collapsible open={openSections.includes('account')}>
            <SectionHeader title="Account & Profile" section="account" />
            <CollapsibleContent className="mt-2 bg-card rounded-xl border border-border p-3">
              <Accordion type="single" collapsible>
                <AccordionItem value="profile">
                  <AccordionTrigger className="text-xs">Profile Name & Avatar</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="space-y-2"><Label className="text-xs">Username</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} className="text-xs h-7" /></div>
                    <div className="space-y-2"><Label className="text-xs">Avatar</Label>
                      <Select value={selectedAvatar} onValueChange={setSelectedAvatar}>
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="🦊">🦊 Fox</SelectItem>
                          <SelectItem value="🐱">🐱 Cat</SelectItem>
                          <SelectItem value="🐻">🐻 Bear</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={saveProfileSettings} size="sm" className="h-7 text-xs">Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="age">
                  <AccordionTrigger className="text-xs">Age Range</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <Select value={ageRange} onValueChange={setAgeRange}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7-9">7-9 years</SelectItem>
                        <SelectItem value="10-12">10-12 years</SelectItem>
                        <SelectItem value="13-15">13-15 years</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={saveProfileSettings} size="sm" className="h-7 text-xs">Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="accountType">
                  <AccordionTrigger className="text-xs">Account Type (One-Time Change)</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Current type: <span className="font-semibold capitalize">{userType}</span>
                    </p>
                    {hasChangedType ? (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        ⚠️ You have already used your one-time account type change. This cannot be changed again.
                      </p>
                    ) : (
                      <>
                        <p className="text-xs text-muted-foreground">
                          Made a mistake during signup? You can change your account type <strong>once</strong>. This action is permanent and cannot be undone.
                        </p>
                        <Button 
                          variant="outline" 
                          size="sm" 
                          className="h-7 text-xs w-full"
                          onClick={() => {
                            setPendingTypeChange(userType === 'creative' ? 'viewer' : 'creative');
                            setShowTypeChangeDialog(true);
                          }}
                        >
                          Switch to {userType === 'creative' ? 'Viewer' : 'Creative'}
                        </Button>
                      </>
                    )}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="theme">
                  <AccordionTrigger className="text-xs">Theme</AccordionTrigger>
                  <AccordionContent>
                    <div className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 text-xs">{theme === "dark" ? <Moon className="h-3 w-3" /> : <Sun className="h-3 w-3" />}{theme === "dark" ? "Dark" : "Light"}</Label>
                      <Switch checked={theme === "dark"} onCheckedChange={toggleTheme} />
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CollapsibleContent>
          </Collapsible>

          {/* Blocked Users */}
          <Collapsible open={openSections.includes('blocked')}>
            <SectionHeader title="Blocked Users" section="blocked" />
            <CollapsibleContent className="mt-2 bg-card rounded-xl border border-border p-3">
              {blockedUsers.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No blocked users</p>
              ) : (
                <div className="space-y-2">
                  {blockedUsers.map(user => (
                    <div key={user.id} className="flex items-center justify-between p-2 bg-background/50 rounded-lg">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{user.avatar}</span>
                        <span className="text-sm font-medium">{user.username}</span>
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => handleUnblock(user.id)}
                        className="h-7 text-xs gap-1"
                      >
                        <UserX className="h-3 w-3" />
                        Unblock
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CollapsibleContent>
          </Collapsible>

          {/* Safety & Content */}
          <Collapsible open={openSections.includes('safety')}>
            <SectionHeader title="Safety & Content" section="safety" />
            <CollapsibleContent className="mt-2 bg-card rounded-xl border border-border p-3">
              <Accordion type="single" collapsible>
                <AccordionItem value="cartoon">
                  <AccordionTrigger className="text-xs">Cartoon-Only Mode</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="flex justify-between"><Label className="text-xs">Enabled</Label><Switch checked={cartoonOnlyMode} onCheckedChange={setCartoonOnlyMode} /></div>
                    <Button onClick={saveContentSettings} size="sm" className="h-7 text-xs">Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="categories">
                  <AccordionTrigger className="text-xs">Categories</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    {['comedy', 'adventure', 'learning', 'music'].map(cat => (
                      <div key={cat} className="flex justify-between"><Label className="capitalize text-xs">{cat}</Label>
                        <Switch checked={contentCategories.includes(cat)} onCheckedChange={(c) => c ? setContentCategories([...contentCategories, cat]) : setContentCategories(contentCategories.filter(x => x !== cat))} />
                      </div>
                    ))}
                    <Button onClick={saveContentSettings} size="sm" className="h-7 text-xs">Save</Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CollapsibleContent>
          </Collapsible>

          {/* Parental Controls */}
          <Collapsible open={openSections.includes('parental')}>
            <SectionHeader title="Parental Controls" section="parental" />
            <CollapsibleContent className="mt-2 bg-card rounded-xl border border-border p-3">
              <Accordion type="single" collapsible>
                <AccordionItem value="profile-pin">
                  <AccordionTrigger className="text-xs">Profile PIN (Child Lock)</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">Set a 4-digit PIN to protect child's profile. Toggle off during weekends/holidays.</p>
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Profile PIN Enabled</Label>
                      <Switch checked={profilePinEnabled} onCheckedChange={setProfilePinEnabled} />
                    </div>
                    <div className="relative">
                      <Input 
                        type={showProfilePin ? "text" : "password"} 
                        maxLength={4} 
                        value={profilePin} 
                        onChange={(e) => setProfilePin(e.target.value.replace(/\D/g, ''))} 
                        placeholder="••••" 
                        className="h-8 text-sm pr-10" 
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-8 w-8"
                        onClick={() => setShowProfilePin(!showProfilePin)}
                      >
                        {showProfilePin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={saveParentalControls} size="sm" className="h-7 text-xs">Save</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs gap-1"
                            disabled={resettingProfilePin}
                          >
                            <Mail className="h-3 w-3" />
                            {resettingProfilePin ? "Sending..." : "Reset via Email"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset Profile PIN?</AlertDialogTitle>
                            <AlertDialogDescription>
                              A new 4-digit PIN will be generated and sent to your registered email address. This will replace the current PIN.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleResetPin("profile")}>
                              Send New PIN
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="parental-pin">
                  <AccordionTrigger className="text-xs">Parental PIN</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">Set a 4-digit PIN to protect parental settings and unlock controls.</p>
                    <div className="relative">
                      <Input 
                        type={showParentalPin ? "text" : "password"} 
                        maxLength={4} 
                        value={parentalPin} 
                        onChange={(e) => setParentalPin(e.target.value.replace(/\D/g, ''))} 
                        placeholder="••••" 
                        className="h-8 text-sm pr-10" 
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-8 w-8"
                        onClick={() => setShowParentalPin(!showParentalPin)}
                      >
                        {showParentalPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                    <div className="flex gap-2">
                      <Button onClick={saveParentalControls} size="sm" className="h-7 text-xs">Save</Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-7 text-xs gap-1"
                            disabled={resettingParentalPin}
                          >
                            <Mail className="h-3 w-3" />
                            {resettingParentalPin ? "Sending..." : "Reset via Email"}
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Reset Parental PIN?</AlertDialogTitle>
                            <AlertDialogDescription>
                              A new 4-digit PIN will be generated and sent to your registered email address. This will replace the current PIN.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleResetPin("parental")}>
                              Send New PIN
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="screen">
                  <AccordionTrigger className="text-xs">Screen Time Limit</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">Set daily screen time limit. Toggle off during holidays.</p>
                    <div className="flex justify-between items-center">
                      <Label className="text-xs">Screen Time Enabled</Label>
                      <Switch checked={screenTimeEnabled} onCheckedChange={setScreenTimeEnabled} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Input 
                        type="number" 
                        min={0} 
                        max={480} 
                        value={screenTimeLimit} 
                        onChange={(e) => setScreenTimeLimit(parseInt(e.target.value) || 0)} 
                        className="h-8 text-sm w-24" 
                        disabled={!screenTimeEnabled}
                      />
                      <span className="text-xs text-muted-foreground">minutes/day</span>
                    </div>
                    <Button onClick={saveParentalControls} size="sm" className="h-7 text-xs">Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="school">
                  <AccordionTrigger className="text-xs">School Hours Lock</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">Block app during school hours (8 AM - 3 PM weekdays). Toggle off during holidays.</p>
                    <div className="flex justify-between"><Label className="text-xs">Enabled</Label><Switch checked={schoolHoursLock} onCheckedChange={setSchoolHoursLock} /></div>
                    <Button onClick={saveParentalControls} size="sm" className="h-7 text-xs">Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="bedtime">
                  <AccordionTrigger className="text-xs">Bedtime Lock</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">Block app during bedtime hours (9 PM - 7 AM).</p>
                    <div className="flex justify-between"><Label className="text-xs">Enabled</Label><Switch checked={bedtimeLock} onCheckedChange={setBedtimeLock} /></div>
                    <Button onClick={saveParentalControls} size="sm" className="h-7 text-xs">Save</Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CollapsibleContent>
          </Collapsible>

          {/* Playback */}
          <Collapsible open={openSections.includes('playback')}>
            <SectionHeader title="Playback" section="playback" />
            <CollapsibleContent className="mt-2 bg-card rounded-xl border border-border p-3">
              <Accordion type="single" collapsible>
                <AccordionItem value="autoplay">
                  <AccordionTrigger className="text-xs">Autoplay</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="flex justify-between"><Label className="text-xs">Enabled</Label><Switch checked={autoplay} onCheckedChange={setAutoplay} /></div>
                    <Button onClick={savePlaybackSettings} size="sm" className="h-7 text-xs">Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="quality">
                  <AccordionTrigger className="text-xs">Video Quality</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <Select value={videoQuality} onValueChange={setVideoQuality}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">Auto (Recommended)</SelectItem>
                        <SelectItem value="high">HD (720p+)</SelectItem>
                        <SelectItem value="medium">SD (480p)</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={savePlaybackSettings} size="sm" className="h-7 text-xs">Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="subtitles">
                  <AccordionTrigger className="text-xs">Subtitles</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="flex justify-between"><Label className="text-xs">Enabled</Label><Switch checked={subtitlesEnabled} onCheckedChange={setSubtitlesEnabled} /></div>
                    <Select value={subtitlesSize} onValueChange={setSubtitlesSize}>
                      <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="small">Small</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="large">Large</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button onClick={savePlaybackSettings} size="sm" className="h-7 text-xs">Save</Button>
                  </AccordionContent>
                </AccordionItem>
                {isCreative && (
                  <AccordionItem value="stats">
                    <AccordionTrigger className="text-xs">Your Stats</AccordionTrigger>
                    <AccordionContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-background/20 backdrop-blur-md rounded-xl p-2 border border-border shadow-lg">
                          <p className="text-lg font-black text-foreground">{totalViews}</p>
                          <p className="text-[10px] text-muted-foreground font-semibold">Views</p>
                        </div>
                        <div className="bg-background/20 backdrop-blur-md rounded-xl p-2 border border-border shadow-lg">
                          <p className="text-lg font-black text-foreground">{totalLikes}</p>
                          <p className="text-[10px] text-muted-foreground font-semibold">Likes</p>
                        </div>
                        <div className="bg-background/20 backdrop-blur-md rounded-xl p-2 border border-border shadow-lg">
                          <p className="text-lg font-black text-foreground">{followersCount}</p>
                          <p className="text-[10px] text-muted-foreground font-semibold">Followers</p>
                        </div>
                        <div className="bg-background/20 backdrop-blur-md rounded-xl p-2 border border-border shadow-lg">
                          <p className="text-lg font-black text-foreground">{videosCount}</p>
                          <p className="text-[10px] text-muted-foreground font-semibold">Videos</p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>
            </CollapsibleContent>
          </Collapsible>

          {/* Notifications */}
          <Collapsible open={openSections.includes('notifications')}>
            <SectionHeader title="Notifications" section="notifications" />
            <CollapsibleContent className="mt-2 bg-card rounded-xl border border-border p-3">
              <Accordion type="single" collapsible>
                <AccordionItem value="notification-types">
                  <AccordionTrigger className="text-xs">Notification Types</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="flex justify-between"><Label className="text-xs">Likes</Label><Switch checked={notifLikes} onCheckedChange={setNotifLikes} /></div>
                    <div className="flex justify-between"><Label className="text-xs">Comments</Label><Switch checked={notifComments} onCheckedChange={setNotifComments} /></div>
                    <div className="flex justify-between"><Label className="text-xs">Follows</Label><Switch checked={notifFollows} onCheckedChange={setNotifFollows} /></div>
                    <div className="flex justify-between"><Label className="text-xs">Replies</Label><Switch checked={notifReplies} onCheckedChange={setNotifReplies} /></div>
                    <div className="flex justify-between">
                      <div>
                        <Label className="text-xs">New Video Uploads</Label>
                        <p className="text-[10px] text-muted-foreground">Get notified when creators you follow upload</p>
                      </div>
                      <Switch checked={notifNewVideos} onCheckedChange={setNotifNewVideos} />
                    </div>
                    <Button onClick={saveNotificationSettings} size="sm" className="h-7 text-xs">Save</Button>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="notification-settings">
                  <AccordionTrigger className="text-xs">Notification Settings</AccordionTrigger>
                  <AccordionContent className="space-y-3">
                    <div className="flex justify-between"><Label className="text-xs">Push Notifications</Label><Switch checked={notifPush} onCheckedChange={setNotifPush} /></div>
                    <div className="flex justify-between"><Label className="text-xs">Sound</Label><Switch checked={notifSound} onCheckedChange={setNotifSound} /></div>
                    <Button onClick={saveNotificationSettings} size="sm" className="h-7 text-xs">Save</Button>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CollapsibleContent>
          </Collapsible>

          {/* App Updates */}
          <Collapsible open={openSections.includes('updates')}>
            <SectionHeader title="App Updates" section="updates" />
            <CollapsibleContent className="mt-2 bg-card rounded-xl border border-border p-3">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Keep ToonlyReels up to date for the best experience.
                </p>
                {updateAvailable ? (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                    <p className="text-xs font-semibold text-primary mb-2">New version available!</p>
                    <Button onClick={() => applyUpdate()} size="sm" className="w-full h-7 text-xs">
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Update Now
                    </Button>
                  </div>
                ) : (
                  <Button 
                    onClick={checkForUpdates} 
                    disabled={checking}
                    variant="outline" 
                    size="sm"
                    className="w-full h-7 text-xs"
                  >
                    <RefreshCw className={`h-3 w-3 mr-1 ${checking ? 'animate-spin' : ''}`} />
                    {checking ? 'Checking...' : 'Check for Updates'}
                  </Button>
                )}
                
                {/* Clear Cache Button */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    Having issues? Clear the cache to get a fresh start.
                  </p>
                  <Button 
                    onClick={clearCacheAndReload} 
                    disabled={clearing}
                    variant="destructive" 
                    size="sm"
                    className="w-full h-7 text-xs"
                  >
                    <Trash2 className={`h-3 w-3 mr-1 ${clearing ? 'animate-pulse' : ''}`} />
                    {clearing ? 'Clearing...' : 'Clear Cache & Reload'}
                  </Button>
                </div>
                
                {/* Diagnostics Mode (for parents) */}
                <div className="pt-2 border-t border-border">
                  <p className="text-xs text-muted-foreground mb-2">
                    Enable diagnostics to debug performance issues on this device.
                  </p>
                  <div className="flex justify-between items-center">
                    <Label className="text-xs">Diagnostics Overlay</Label>
                    <Switch 
                      checked={localStorage.getItem('diagnostics') === 'true'} 
                      onCheckedChange={(checked) => {
                        localStorage.setItem('diagnostics', checked ? 'true' : 'false');
                        toast.success(checked ? 'Diagnostics enabled. Refresh to see overlay.' : 'Diagnostics disabled.');
                      }} 
                    />
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* FAQ */}
          <Collapsible open={openSections.includes('faq')}>
            <SectionHeader title="FAQ" section="faq" />
            <CollapsibleContent className="mt-2 bg-card rounded-xl border border-border p-3">
              <Accordion type="single" collapsible>
                <AccordionItem value="what">
                  <AccordionTrigger className="text-xs">What is ToonlyReels?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground">ToonlyReels is a kid-safe cartoon reels platform made by SEMO Group. Kids can watch short animated clips, music toons, fun stories, and educational shorts — all age filtered.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="cartoon">
                  <AccordionTrigger className="text-xs">Why only cartoon content?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground">ToonlyReels is designed strictly for kids. We automatically block adult themes, scary content, violence, political content, and anything unsafe.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="report">
                  <AccordionTrigger className="text-xs">How do I report something inappropriate?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground">Tap the Report button on any reel or any creator's profile. Our moderation team reviews reports within 24–72 hours.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="comments">
                  <AccordionTrigger className="text-xs">Are comments safe?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground">Comments are filtered with AI kid-safe moderation, keyword blocking, and human review for flagged comments. Parents can disable comments completely in Settings → Parental Controls.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="messaging">
                  <AccordionTrigger className="text-xs">Can kids message each other?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground">Messaging is off and kids cannot message each other. ToonlyReels does not allow messaging between users to ensure maximum child safety.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="uploads">
                  <AccordionTrigger className="text-xs">How do uploads work?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground">Creators can upload reels from the Upload tab. All uploads are reviewed before being public.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="download">
                  <AccordionTrigger className="text-xs">Why can't I download reels?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground">Downloading reel videos is a premium feature.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="accounttype">
                  <AccordionTrigger className="text-xs">Can I change my account type?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground">If you accidentally chose the wrong account type (Viewer vs Creative) during signup, you can change it <span className="font-semibold text-destructive">once and only once</span> in Settings → Account & Profile → Account Type. This is permanent and cannot be reversed.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="delete">
                  <AccordionTrigger className="text-xs">How do I delete my account?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground">To delete your account, go to <span className="font-semibold">Settings → Privacy Center</span>, scroll down, and click the <span className="font-semibold text-destructive">"Delete Account"</span> button. You'll be asked to confirm before your account is permanently deleted. This action cannot be undone and will remove all your videos, likes, comments, and followers.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="contact">
                  <AccordionTrigger className="text-xs">How do I contact ToonlyReels?</AccordionTrigger>
                  <AccordionContent>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Email: info@semogroup.com</p>
                      <p>Website: www.semogroup.com</p>
                      <p>App Icon: TR (ToonlyReels official avatar)</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CollapsibleContent>
          </Collapsible>

          {/* Terms of Use */}
          <Collapsible open={openSections.includes('terms')}>
            <SectionHeader title="Terms of Use" section="terms" />
            <CollapsibleContent className="mt-2 bg-card rounded-xl border border-border p-3">
              <Accordion type="single" collapsible>
                <AccordionItem value="terms">
                  <AccordionTrigger className="text-xs">View Terms</AccordionTrigger>
                  <AccordionContent className="space-y-2 text-xs text-muted-foreground">
                    <p className="font-semibold">Last updated: 2025</p>
                    <p>Welcome to ToonlyReels, a kid-friendly cartoon reels app created by SEMO Group. By using ToonlyReels, you agree to these Terms of Use.</p>
                    
                    <div>
                      <p className="font-semibold text-foreground">1. Eligibility</p>
                      <p>ToonlyReels is designed for users ages 4–15. Parents/guardians must supervise younger users.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">2. Account Responsibilities</p>
                      <p>You must provide accurate profile information. Parents are responsible for supervising accounts created for children. You must not impersonate others or create misleading profiles.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">3. Kid-Safe Community Rules</p>
                      <p>You may not upload or share: adult content, violence/gore/scary material, hate speech, bullying/harassment, political content, harmful challenges/dares, or unsafe products/services. Violation may result in content removal or account suspension.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">4. Content Ownership</p>
                      <p>You keep ownership of your uploaded reels, but you give ToonlyReels permission to store, display, moderate, and distribute within the app. We NEVER sell user data or videos.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">5. Moderation</p>
                      <p>We may review content, remove unsafe uploads, and suspend creators who post harmful material. All reports are reviewed within 24–72 hours.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">6. Premium Features</p>
                      <p>Premium subscriptions allow downloading reels, removing ads, and unlocking exclusive content. Subscriptions auto-renew unless turned off through app settings.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">7. Termination</p>
                      <p>We may limit or disable accounts that violate safety rules, upload harmful content, or attempt to bypass parental controls.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">8. Contact</p>
                      <p>Email: info@semogroup.com | Website: www.semogroup.com | App icon/logo: TR</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CollapsibleContent>
          </Collapsible>

          {/* Privacy Center */}
          <Collapsible open={openSections.includes('privacy')}>
            <SectionHeader title="Privacy Center" section="privacy" />
            <CollapsibleContent className="mt-2 bg-card rounded-xl border border-border p-3">
              <Accordion type="single" collapsible>
                <AccordionItem value="privacy">
                  <AccordionTrigger className="text-xs">View Privacy Policy</AccordionTrigger>
                  <AccordionContent className="space-y-2 text-xs text-muted-foreground">
                    <p className="font-semibold">ToonlyReels is COPPA-compliant and designed for child safety.</p>
                    
                    <div>
                      <p className="font-semibold text-foreground">1. What information we collect</p>
                      <p>We collect minimal data: profile name/nickname, avatar (emojis), age range (not exact birth date), parent/guardian email (optional), and uploaded content.</p>
                      <p className="mt-1">We do NOT collect: exact addresses, phone numbers, legal names, financial data, or facial recognition data</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">2. How data is used</p>
                      <p>We use your data to keep content age-appropriate, personalize recommendations, improve safety, and support your account. We do not sell data to advertisers or third parties.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">3. Data for Kids Under 13</p>
                      <p>Parents can delete data, ask for account export, restrict features (comments, messages, uploads), and set time limits.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">4. Cookies & Local Storage</p>
                      <p>Used only for saving login state, parental PIN access, and safe viewing history. No tracking across other apps or websites.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">5. Deleting Your Data</p>
                      <p>You may request deletion anytime by emailing: info@semogroup.com</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">6. Security</p>
                      <p>We use encryption, secure storage, and safety auditing. No system is 100% secure, but we take strong measures to protect children.</p>
                    </div>

                    <div className="pt-3 border-t">
                      <Button 
                        variant="destructive" 
                        size="sm" 
                        className="w-full h-7 text-xs"
                        onClick={() => {
                          setDeleteConfirmText("");
                          setShowDeleteDialog(true);
                        }}
                      >
                        Delete Account
                      </Button>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CollapsibleContent>
          </Collapsible>

          {/* User Safety Guide */}
          <Collapsible open={openSections.includes('safetyguide')}>
            <SectionHeader title="User Safety Guide" section="safetyguide" />
            <CollapsibleContent className="mt-2 bg-card rounded-xl border border-border p-3">
              <Accordion type="single" collapsible>
                <AccordionItem value="safety">
                  <AccordionTrigger className="text-xs">View Safety Guide</AccordionTrigger>
                  <AccordionContent className="space-y-2 text-xs text-muted-foreground">
                    <p className="font-semibold">ToonlyReels is built around kid safety first.</p>
                    
                    <div>
                      <p className="font-semibold text-foreground">1. Safe Content System</p>
                      <p>We use AI detection for harmful videos, human moderation, strict cartoon-only rules, and automatic age filtering.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">2. Reporting Bad Content</p>
                      <p>If something seems wrong, tap the Report button on a reel or the Report Creator button on a profile. Reports are checked within 24–72 hours.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">3. Parental Controls (PIN-Protected)</p>
                      <p>Parents can set screen time limits, bedtime mode, comment restrictions, messaging restrictions, age filters, and upload permissions.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">4. Messaging Safety</p>
                      <p>Messaging is disabled by default, optional for older kids, monitored by automated filters, and PIN-protected for parents.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">5. Comment Safety</p>
                      <p>Comments are filtered to remove bullying, threats, adult themes, spam, and personal info. Parents can also turn off comments entirely.</p>
                    </div>

                    <div>
                      <p className="font-semibold text-foreground">6. Creator Upload Safety</p>
                      <p>All uploads go through automated filtering and human moderator review with age-range tagging. Creators lose upload access if they violate rules.</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CollapsibleContent>
          </Collapsible>

          {/* Help Center */}
          <Collapsible open={openSections.includes('help')}>
            <SectionHeader title="Help Center" section="help" />
            <CollapsibleContent className="mt-2 bg-card rounded-xl border border-border p-3">
              <Accordion type="single" collapsible>
                <AccordionItem value="support">
                  <AccordionTrigger className="text-xs">General Support</AccordionTrigger>
                  <AccordionContent>
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p>Email: info@semogroup.com</p>
                      <p>Website: www.semogroup.com</p>
                    </div>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="loading">
                  <AccordionTrigger className="text-xs">What should I do if a reel won't load?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground">Try refreshing your internet, closing & reopening the app, or restarting your device.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="upload-help">
                  <AccordionTrigger className="text-xs">How do I upload a reel?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground">Go to Upload → Select Thumbnail → Add Title → Submit.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="protection">
                  <AccordionTrigger className="text-xs">How does ToonlyReels protect kids?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground">Filters violent/adult content, human moderators, parental PIN, and messaging locked by default.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="pin-reset">
                  <AccordionTrigger className="text-xs">How do I reset my parent PIN?</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground">Go to Settings → Parental Controls → "Forgot PIN?" You will be asked to verify your email.</p>
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="icon">
                  <AccordionTrigger className="text-xs">App Icon / Avatar Info</AccordionTrigger>
                  <AccordionContent>
                    <p className="text-xs text-muted-foreground">The official ToonlyReels app icon is: TR with a red-orange gradient background.</p>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
      
      {/* Account Type Change Dialog */}
      <AlertDialog open={showTypeChangeDialog} onOpenChange={setShowTypeChangeDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">⚠️ Permanent Account Type Change</AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-2">
              <p>You are about to change your account type from <strong className="capitalize">{userType}</strong> to <strong className="capitalize">{pendingTypeChange}</strong>.</p>
              <p className="text-destructive font-semibold">This is a ONE-TIME change and CANNOT be undone. You will never be able to change your account type again.</p>
              <p>Are you absolutely sure you want to proceed?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs" onClick={() => setPendingTypeChange(null)}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleAccountTypeChange} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 text-xs">
              Yes, Change Permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="text-sm">⚠️ Delete Your Account</AlertDialogTitle>
            <AlertDialogDescription className="text-xs space-y-3" asChild>
              <div>
                <p>This action cannot be undone. This will permanently delete your account and remove all your data including videos, likes, comments, and followers from our servers.</p>
                <p className="text-destructive font-semibold">To confirm, please type DELETE below:</p>
                <Input 
                  value={deleteConfirmText}
                  onChange={(e) => setDeleteConfirmText(e.target.value.toUpperCase())}
                  placeholder="Type DELETE to confirm"
                  className="h-8 text-xs mt-2"
                />
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="h-8 text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteAccount} 
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 h-8 text-xs"
              disabled={deleteConfirmText !== "DELETE"}
            >
              Delete My Account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Goodbye Message Overlay */}
      {showGoodbyeMessage && (
        <div className="fixed inset-0 z-50 bg-background/95 flex items-center justify-center">
          <div className="text-center space-y-4 p-6">
            <div className="text-6xl">👋</div>
            <h2 className="text-xl font-bold text-foreground">Goodbye!</h2>
            <p className="text-sm text-muted-foreground">
              Your account has been deleted. We're sorry to see you go.
            </p>
            <p className="text-xs text-muted-foreground">
              Redirecting you shortly...
            </p>
          </div>
        </div>
      )}
      
    </div>
    </ResponsiveLayout>
  );
};

export default Settings;