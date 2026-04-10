import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Eye, Heart, Clock, Users, TrendingUp, Calendar } from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface Video {
  id: string;
  title: string;
  description: string;
  views_count: number;
  likes_count: number;
  created_at: string;
}

interface AnalyticsData {
  totalViews: number;
  uniqueViewers: number;
  averageWatchTime: number;
  completionRate: number;
  engagementRate: number;
}

interface TrendData {
  date: string;
  views: number;
  engagement: number;
}

const VideoAnalytics = () => {
  const navigate = useNavigate();
  const { videoId } = useParams();
  const [video, setVideo] = useState<Video | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [timeRange, setTimeRange] = useState<'week' | 'month'>('week');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchVideoAndAnalytics();
  }, [videoId, timeRange]);

  const fetchVideoAndAnalytics = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Fetch video details
      const { data: videoData, error: videoError } = await supabase
        .from('videos')
        .select('*')
        .eq('id', videoId)
        .eq('creator_id', user.id)
        .single();

      if (videoError) throw videoError;
      if (!videoData) {
        toast.error('Video not found or access denied');
        navigate('/profile');
        return;
      }

      setVideo(videoData);

      // Fetch analytics data
      const { data: analyticsData, error: analyticsError } = await supabase
        .from('video_analytics')
        .select('*')
        .eq('video_id', videoId);

      if (analyticsError) throw analyticsError;

      // Calculate metrics
      const totalViews = analyticsData?.length || 0;
      const uniqueViewers = new Set(analyticsData?.map(a => a.viewer_id).filter(Boolean)).size;
      const totalWatchTime = analyticsData?.reduce((sum, a) => sum + (a.watch_duration || 0), 0) || 0;
      const averageWatchTime = totalViews > 0 ? Math.round(totalWatchTime / totalViews) : 0;
      const completedViews = analyticsData?.filter(a => a.completed).length || 0;
      const completionRate = totalViews > 0 ? Math.round((completedViews / totalViews) * 100) : 0;
      const engagementRate = videoData.views_count > 0 
        ? Math.round((videoData.likes_count / videoData.views_count) * 100) 
        : 0;

      setAnalytics({
        totalViews,
        uniqueViewers,
        averageWatchTime,
        completionRate,
        engagementRate,
      });

      // Calculate trend data
      const daysBack = timeRange === 'week' ? 7 : 30;
      const dates = Array.from({ length: daysBack }, (_, i) => {
        const date = new Date();
        date.setDate(date.getDate() - (daysBack - 1 - i));
        return date.toISOString().split('T')[0];
      });

      const trendsMap = new Map<string, { views: number; likes: number }>();
      dates.forEach(date => trendsMap.set(date, { views: 0, likes: 0 }));

      // Count views per day
      analyticsData?.forEach(a => {
        const date = new Date(a.watched_at).toISOString().split('T')[0];
        if (trendsMap.has(date)) {
          const current = trendsMap.get(date)!;
          trendsMap.set(date, { ...current, views: current.views + 1 });
        }
      });

      const trends: TrendData[] = Array.from(trendsMap.entries()).map(([date, data]) => ({
        date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        views: data.views,
        engagement: data.views > 0 ? Math.round((data.views / totalViews) * 100) : 0,
      }));

      setTrendData(trends);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (!video || !analytics) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-4xl mx-auto p-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button
            size="icon"
            variant="ghost"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black">Video Analytics</h1>
            <p className="text-sm text-muted-foreground">{video.title}</p>
          </div>
        </div>

        {/* Time Range Selector */}
        <div className="flex gap-2 mb-4">
          <Button
            variant={timeRange === 'week' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('week')}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Last 7 Days
          </Button>
          <Button
            variant={timeRange === 'month' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTimeRange('month')}
          >
            <Calendar className="h-4 w-4 mr-2" />
            Last 30 Days
          </Button>
        </div>

        {/* Trend Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="p-6">
            <h3 className="text-lg font-black mb-4">Views Over Time</h3>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorViews" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="views" 
                  stroke="hsl(var(--primary))" 
                  fillOpacity={1} 
                  fill="url(#colorViews)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-black mb-4">Engagement Trend</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line 
                  type="monotone" 
                  dataKey="engagement" 
                  stroke="hsl(var(--accent))" 
                  strokeWidth={3}
                  dot={{ fill: 'hsl(var(--accent))', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-primary/10">
                <Eye className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Total Views</span>
            </div>
            <p className="text-3xl font-black text-foreground">{analytics.totalViews}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-accent/10">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">Unique Viewers</span>
            </div>
            <p className="text-3xl font-black text-foreground">{analytics.uniqueViewers}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-fun-yellow/10">
                <Clock className="h-5 w-5 text-fun-yellow" />
              </div>
              <span className="text-sm text-muted-foreground">Avg Watch Time</span>
            </div>
            <p className="text-3xl font-black text-foreground">{formatDuration(analytics.averageWatchTime)}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-primary/10">
                <TrendingUp className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Completion Rate</span>
            </div>
            <p className="text-3xl font-black text-foreground">{analytics.completionRate}%</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-fun-pink/10">
                <Heart className="h-5 w-5 text-fun-pink" />
              </div>
              <span className="text-sm text-muted-foreground">Total Likes</span>
            </div>
            <p className="text-3xl font-black text-foreground">{video.likes_count}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-accent/10">
                <TrendingUp className="h-5 w-5 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">Engagement Rate</span>
            </div>
            <p className="text-3xl font-black text-foreground">{analytics.engagementRate}%</p>
          </Card>
        </div>

        {/* Video Info */}
        <Card className="p-6">
          <h2 className="text-xl font-black mb-3">Video Details</h2>
          <div className="space-y-2">
            <div>
              <span className="text-sm text-muted-foreground">Title:</span>
              <p className="font-semibold">{video.title}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Description:</span>
              <p className="text-sm">{video.description || 'No description'}</p>
            </div>
            <div>
              <span className="text-sm text-muted-foreground">Published:</span>
              <p className="text-sm">{new Date(video.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default VideoAnalytics;
