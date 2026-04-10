import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowLeft, Video, Eye, Heart, TrendingUp, Users } from 'lucide-react';
import { toast } from 'sonner';
import ResponsiveLayout from '@/components/ResponsiveLayout';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardStats {
  totalVideos: number;
  totalViews: number;
  totalLikes: number;
  totalFollowers: number;
  averageEngagement: number;
  topVideo: {
    title: string;
    views: number;
  } | null;
}

interface VideoPerformance {
  title: string;
  views: number;
  likes: number;
  engagement: number;
}

const CreatorDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [videoPerformance, setVideoPerformance] = useState<VideoPerformance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/auth');
        return;
      }

      // Check if user is creative
      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);

      if (!roles?.some(r => r.role === 'creative')) {
        toast.error('Dashboard is only available for creatives');
        navigate('/profile');
        return;
      }

      // Fetch all videos
      const { data: videos, error: videosError } = await supabase
        .from('videos')
        .select('*')
        .eq('creator_id', user.id)
        .order('views_count', { ascending: false });

      if (videosError) throw videosError;

      // Fetch followers count
      const { count: followersCount } = await supabase
        .from('follows')
        .select('*', { count: 'exact', head: true })
        .eq('following_id', user.id);

      // Calculate stats
      const totalVideos = videos?.length || 0;
      const totalViews = videos?.reduce((sum, v) => sum + v.views_count, 0) || 0;
      const totalLikes = videos?.reduce((sum, v) => sum + v.likes_count, 0) || 0;
      const averageEngagement = totalViews > 0 ? Math.round((totalLikes / totalViews) * 100) : 0;
      const topVideo = videos?.[0] ? {
        title: videos[0].title,
        views: videos[0].views_count,
      } : null;

      setStats({
        totalVideos,
        totalViews,
        totalLikes,
        totalFollowers: followersCount || 0,
        averageEngagement,
        topVideo,
      });

      // Prepare video performance data for chart (top 5 videos)
      const performance: VideoPerformance[] = videos?.slice(0, 5).map(v => ({
        title: v.title.length > 15 ? v.title.substring(0, 15) + '...' : v.title,
        views: v.views_count,
        likes: v.likes_count,
        engagement: v.views_count > 0 ? Math.round((v.likes_count / v.views_count) * 100) : 0,
      })) || [];

      setVideoPerformance(performance);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Loading dashboard...</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">No data available</p>
      </div>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="min-h-screen bg-background pb-24 md:pb-8">
        <div className="max-w-6xl mx-auto p-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <Button
              size="icon"
              variant="ghost"
              onClick={() => navigate('/profile')}
              className="rounded-full md:hidden"
            >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black">Creator Dashboard</h1>
            <p className="text-sm text-muted-foreground">Your channel performance overview</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-primary/10">
                <Video className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm text-muted-foreground">Total Videos</span>
            </div>
            <p className="text-3xl font-black text-foreground">{stats.totalVideos}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-accent/10">
                <Eye className="h-5 w-5 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">Total Views</span>
            </div>
            <p className="text-3xl font-black text-foreground">{stats.totalViews.toLocaleString()}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-fun-pink/10">
                <Heart className="h-5 w-5 text-fun-pink" />
              </div>
              <span className="text-sm text-muted-foreground">Total Likes</span>
            </div>
            <p className="text-3xl font-black text-foreground">{stats.totalLikes.toLocaleString()}</p>
          </Card>

          <Card className="p-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 rounded-full bg-fun-yellow/10">
                <Users className="h-5 w-5 text-fun-yellow" />
              </div>
              <span className="text-sm text-muted-foreground">Followers</span>
            </div>
            <p className="text-3xl font-black text-foreground">{stats.totalFollowers.toLocaleString()}</p>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">Average Engagement</h3>
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <p className="text-5xl font-black text-primary mb-2">{stats.averageEngagement}%</p>
            <p className="text-sm text-muted-foreground">Likes per view across all videos</p>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black">Top Performing Video</h3>
              <Video className="h-5 w-5 text-accent" />
            </div>
            {stats.topVideo ? (
              <>
                <p className="font-bold text-lg mb-1 line-clamp-1">{stats.topVideo.title}</p>
                <p className="text-3xl font-black text-accent">{stats.topVideo.views.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">views</p>
              </>
            ) : (
              <p className="text-muted-foreground">No videos yet</p>
            )}
          </Card>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <Card className="p-6">
            <h3 className="text-lg font-black mb-4">Top 5 Videos by Views</h3>
            {videoPerformance.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={videoPerformance} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis 
                    type="number"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                  />
                  <YAxis 
                    type="category"
                    dataKey="title" 
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={12}
                    width={100}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="views" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                <p className="text-sm">No videos uploaded yet. Upload your first video to see stats!</p>
              </div>
            )}
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-black mb-4">Engagement Rate by Video</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={videoPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="title" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  label={{ value: 'Engagement %', angle: -90, position: 'insideLeft' }}
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
                  dot={{ fill: 'hsl(var(--accent))', r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="p-6">
          <h3 className="text-lg font-black mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => navigate('/upload')} className="flex items-center gap-2">
              <Video className="h-4 w-4" />
              Upload New Video
            </Button>
            <Button variant="outline" onClick={() => navigate('/profile')} className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              View Profile
            </Button>
          </div>
        </Card>
      </div>
    </div>
    </ResponsiveLayout>
  );
};

export default CreatorDashboard;
