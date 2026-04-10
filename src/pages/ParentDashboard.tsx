import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Clock, Eye, Heart, Shield, Lock, Video, Calendar, HardDrive, Activity, Mail } from 'lucide-react';
import { toast } from 'sonner';
import BottomNav from '@/components/BottomNav';
import StorageAnalytics from '@/components/StorageAnalytics';
import WeeklyScreenTimeChart from '@/components/WeeklyScreenTimeChart';
import ContentCategoryChart from '@/components/ContentCategoryChart';
import MonthlyReportSettings from '@/components/MonthlyReportSettings';

interface ActivityStats {
  totalWatchTime: number;
  videosWatched: number;
  likesGiven: number;
  commentsPosted: number;
  lastActive: string | null;
}

interface ParentalSettings {
  screenTimeLimit: number;
  schoolHoursLock: boolean;
  schoolStartTime: string;
  schoolEndTime: string;
  bedtimeLock: boolean;
  bedtimeStart: string;
  bedtimeEnd: string;
}

const ParentDashboard = () => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [pin, setPin] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityStats>({
    totalWatchTime: 0,
    videosWatched: 0,
    likesGiven: 0,
    commentsPosted: 0,
    lastActive: null,
  });
  const [settings, setSettings] = useState<ParentalSettings>({
    screenTimeLimit: 60,
    schoolHoursLock: false,
    schoolStartTime: '08:00',
    schoolEndTime: '15:00',
    bedtimeLock: false,
    bedtimeStart: '21:00',
    bedtimeEnd: '07:00',
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate('/auth');
      return;
    }
    setUserId(user.id);
    setLoading(false);
  };

  const verifyPin = async () => {
    if (!userId || !pin) return;

    try {
      const { data: isValid } = await supabase.rpc('verify_parental_pin', {
        _user_id: userId,
        _raw_pin: pin,
      });

      if (isValid) {
        setIsAuthenticated(true);
        await fetchActivityData();
        await fetchSettings();
        toast.success('Access granted');
      } else {
        toast.error('Invalid PIN');
      }
    } catch (error) {
      // If no PIN set, allow access
      setIsAuthenticated(true);
      await fetchActivityData();
      await fetchSettings();
    }
  };

  const fetchActivityData = async () => {
    if (!userId) return;

    try {
      // Get watch time from analytics
      const { data: analytics } = await supabase
        .from('video_analytics')
        .select('watch_duration, watched_at')
        .eq('viewer_id', userId)
        .order('watched_at', { ascending: false });

      const totalWatchTime = analytics?.reduce((sum, a) => sum + (a.watch_duration || 0), 0) || 0;
      const lastActive = analytics?.[0]?.watched_at || null;

      // Get likes count
      const { count: likesCount } = await supabase
        .from('likes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      // Get comments count
      const { count: commentsCount } = await supabase
        .from('comments')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      setActivity({
        totalWatchTime: Math.round(totalWatchTime / 60), // Convert to minutes
        videosWatched: analytics?.length || 0,
        likesGiven: likesCount || 0,
        commentsPosted: commentsCount || 0,
        lastActive,
      });
    } catch (error) {
      console.error('Error fetching activity:', error);
    }
  };

  const fetchSettings = async () => {
    if (!userId) return;

    try {
      const { data } = await supabase
        .from('parental_controls')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (data) {
        setSettings({
          screenTimeLimit: data.screen_time_limit || 60,
          schoolHoursLock: data.school_hours_lock || false,
          schoolStartTime: data.school_start_time || '08:00',
          schoolEndTime: data.school_end_time || '15:00',
          bedtimeLock: data.bedtime_lock || false,
          bedtimeStart: data.bedtime_start || '21:00',
          bedtimeEnd: data.bedtime_end || '07:00',
        });
      }
    } catch (error) {
      console.error('Error fetching settings:', error);
    }
  };

  const saveSettings = async () => {
    if (!userId) return;

    try {
      await supabase.from('parental_controls').upsert({
        user_id: userId,
        screen_time_limit: settings.screenTimeLimit,
        school_hours_lock: settings.schoolHoursLock,
        school_start_time: settings.schoolStartTime,
        school_end_time: settings.schoolEndTime,
        bedtime_lock: settings.bedtimeLock,
        bedtime_start: settings.bedtimeStart,
        bedtime_end: settings.bedtimeEnd,
      });
      toast.success('Settings saved');
    } catch (error) {
      toast.error('Failed to save settings');
    }
  };

  const formatTime = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  // PIN verification screen
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-sm">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-8 w-8 text-primary" />
            </div>
            <CardTitle>Parent Dashboard</CardTitle>
            <CardDescription>Enter your parental PIN to access</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Parental PIN</Label>
              <Input
                type="password"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                placeholder="••••"
                className="text-center text-2xl tracking-widest"
              />
            </div>
            <Button onClick={verifyPin} className="w-full" disabled={pin.length < 4}>
              <Lock className="h-4 w-4 mr-2" />
              Unlock Dashboard
            </Button>
            <Button variant="ghost" onClick={() => navigate(-1)} className="w-full">
              Cancel
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl font-black">Parent Dashboard</h1>
            <p className="text-sm text-muted-foreground">Monitor activity & manage controls</p>
          </div>
        </div>

        <Tabs defaultValue="activity" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-4">
            <TabsTrigger value="activity" className="text-xs">
              <Activity className="h-3 w-3 mr-1" />
              Activity
            </TabsTrigger>
            <TabsTrigger value="controls" className="text-xs">
              <Lock className="h-3 w-3 mr-1" />
              Controls
            </TabsTrigger>
            <TabsTrigger value="reports" className="text-xs">
              <Mail className="h-3 w-3 mr-1" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="storage" className="text-xs">
              <HardDrive className="h-3 w-3 mr-1" />
              Storage
            </TabsTrigger>
          </TabsList>

          <TabsContent value="activity" className="space-y-4">
            {/* Weekly Screen Time Chart */}
            {userId && <WeeklyScreenTimeChart userId={userId} />}
            
            {/* Content Category Chart */}
            {userId && <ContentCategoryChart userId={userId} />}
            
            {/* Activity Stats */}
            <div>
              <h2 className="text-lg font-bold mb-3 flex items-center gap-2">
                <Eye className="h-5 w-5 text-primary" />
                Activity Overview
              </h2>
              <div className="grid grid-cols-2 gap-3">
                <Card>
                  <CardContent className="p-4 text-center">
                    <Clock className="h-6 w-6 mx-auto mb-2 text-fun-blue" />
                    <p className="text-2xl font-black">{formatTime(activity.totalWatchTime)}</p>
                    <p className="text-xs text-muted-foreground">Total Watch Time</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Video className="h-6 w-6 mx-auto mb-2 text-fun-green" />
                    <p className="text-2xl font-black">{activity.videosWatched}</p>
                    <p className="text-xs text-muted-foreground">Videos Watched</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Heart className="h-6 w-6 mx-auto mb-2 text-fun-coral" />
                    <p className="text-2xl font-black">{activity.likesGiven}</p>
                    <p className="text-xs text-muted-foreground">Likes Given</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4 text-center">
                    <Calendar className="h-6 w-6 mx-auto mb-2 text-fun-yellow" />
                    <p className="text-sm font-bold">
                      {activity.lastActive
                        ? new Date(activity.lastActive).toLocaleDateString()
                        : 'Never'}
                    </p>
                    <p className="text-xs text-muted-foreground">Last Active</p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="controls" className="space-y-4">

        {/* Screen Time Settings */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Screen Time Limit
            </CardTitle>
            <CardDescription className="text-xs">
              Set daily viewing limit. App will lock when time is up.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label className="text-sm">Daily Limit</Label>
                <span className="text-sm font-bold text-primary">{formatTime(settings.screenTimeLimit)}</span>
              </div>
              <Slider
                value={[settings.screenTimeLimit]}
                onValueChange={([value]) => setSettings({ ...settings, screenTimeLimit: value })}
                max={180}
                min={15}
                step={15}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>15 min</span>
                <span>3 hours</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* School Hours Lock */}
        <Card className="mb-4">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  School Hours Lock
                </CardTitle>
                <CardDescription className="text-xs">
                  Block access during school hours
                </CardDescription>
              </div>
              <Switch
                checked={settings.schoolHoursLock}
                onCheckedChange={(checked) => setSettings({ ...settings, schoolHoursLock: checked })}
              />
            </div>
          </CardHeader>
          {settings.schoolHoursLock && (
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Start Time</Label>
                  <Input
                    type="time"
                    value={settings.schoolStartTime}
                    onChange={(e) => setSettings({ ...settings, schoolStartTime: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">End Time</Label>
                  <Input
                    type="time"
                    value={settings.schoolEndTime}
                    onChange={(e) => setSettings({ ...settings, schoolEndTime: e.target.value })}
                    className="h-8"
                  />
                </div>
              </div>
            </CardContent>
          )}
        </Card>

        {/* Bedtime Lock */}
        <Card className="mb-6">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  Bedtime Lock
                </CardTitle>
                <CardDescription className="text-xs">
                  Block access during bedtime hours
                </CardDescription>
              </div>
              <Switch
                checked={settings.bedtimeLock}
                onCheckedChange={(checked) => setSettings({ ...settings, bedtimeLock: checked })}
              />
            </div>
          </CardHeader>
          {settings.bedtimeLock && (
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Bedtime Start</Label>
                  <Input
                    type="time"
                    value={settings.bedtimeStart}
                    onChange={(e) => setSettings({ ...settings, bedtimeStart: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Wake Time</Label>
                  <Input
                    type="time"
                    value={settings.bedtimeEnd}
                    onChange={(e) => setSettings({ ...settings, bedtimeEnd: e.target.value })}
                    className="h-8"
                  />
                </div>
              </div>
            </CardContent>
          )}
        </Card>

            <Button onClick={saveSettings} className="w-full" size="lg">
              Save All Settings
            </Button>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            {userId && <MonthlyReportSettings userId={userId} />}
          </TabsContent>

          <TabsContent value="storage" className="space-y-4">
            <StorageAnalytics />
          </TabsContent>
        </Tabs>
      </div>
      <BottomNav />
    </div>
  );
};

export default ParentDashboard;
