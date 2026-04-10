import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Folder } from 'lucide-react';

interface ContentCategoryChartProps {
  userId: string;
}

interface CategoryData {
  name: string;
  value: number;
  color: string;
}

const CATEGORY_COLORS: Record<string, string> = {
  comedy: 'hsl(var(--fun-yellow))',
  adventure: 'hsl(var(--fun-green))',
  learning: 'hsl(var(--fun-blue))',
  music: 'hsl(var(--fun-coral))',
  animals: 'hsl(142, 70%, 45%)',
  sports: 'hsl(200, 70%, 50%)',
  art: 'hsl(280, 70%, 60%)',
  science: 'hsl(180, 60%, 45%)',
  stories: 'hsl(320, 70%, 55%)',
  other: 'hsl(var(--muted-foreground))',
};

const CATEGORY_LABELS: Record<string, string> = {
  comedy: '😂 Comedy',
  adventure: '🗺️ Adventure',
  learning: '📚 Learning',
  music: '🎵 Music',
  animals: '🐾 Animals',
  sports: '⚽ Sports',
  art: '🎨 Art',
  science: '🔬 Science',
  stories: '📖 Stories',
  other: '📁 Other',
};

const ContentCategoryChart = ({ userId }: ContentCategoryChartProps) => {
  const [categoryData, setCategoryData] = useState<CategoryData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalVideos, setTotalVideos] = useState(0);

  useEffect(() => {
    fetchCategoryData();
  }, [userId]);

  const fetchCategoryData = async () => {
    try {
      // Get all video analytics for this user with video tags
      const { data: analytics, error } = await supabase
        .from('video_analytics')
        .select(`
          video_id,
          watch_duration,
          videos:video_id (
            tags
          )
        `)
        .eq('viewer_id', userId);

      if (error) {
        console.error('Error fetching category data:', error);
        setLoading(false);
        return;
      }

      // Count categories from watched videos
      const categoryCounts: Record<string, number> = {};
      let total = 0;

      analytics?.forEach((item: any) => {
        const tags = item.videos?.tags || [];
        if (tags.length === 0) {
          categoryCounts['other'] = (categoryCounts['other'] || 0) + 1;
        } else {
          // Use first tag as primary category
          const primaryTag = tags[0]?.toLowerCase() || 'other';
          categoryCounts[primaryTag] = (categoryCounts[primaryTag] || 0) + 1;
        }
        total++;
      });

      setTotalVideos(total);

      // Convert to chart data
      const chartData: CategoryData[] = Object.entries(categoryCounts)
        .map(([category, count]) => ({
          name: CATEGORY_LABELS[category] || category.charAt(0).toUpperCase() + category.slice(1),
          value: count,
          color: CATEGORY_COLORS[category] || CATEGORY_COLORS['other'],
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6); // Top 6 categories

      setCategoryData(chartData);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Folder className="h-4 w-4" />
            Content Categories
          </CardTitle>
        </CardHeader>
        <CardContent className="h-48 flex items-center justify-center">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </CardContent>
      </Card>
    );
  }

  if (categoryData.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Folder className="h-4 w-4" />
            Content Categories
          </CardTitle>
          <CardDescription className="text-xs">
            What types of videos are watched most
          </CardDescription>
        </CardHeader>
        <CardContent className="h-48 flex items-center justify-center">
          <p className="text-sm text-muted-foreground">No viewing data yet</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Folder className="h-4 w-4" />
          Content Categories
        </CardTitle>
        <CardDescription className="text-xs">
          Based on {totalVideos} videos watched
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={categoryData}
                cx="50%"
                cy="50%"
                innerRadius={40}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value: number) => [`${value} videos`, '']}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderColor: 'hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Legend
                layout="vertical"
                align="right"
                verticalAlign="middle"
                formatter={(value) => (
                  <span className="text-xs text-foreground">{value}</span>
                )}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Top category highlight */}
        {categoryData[0] && (
          <div className="mt-4 p-3 rounded-lg bg-primary/10 text-center">
            <p className="text-xs text-muted-foreground">Favorite Category</p>
            <p className="font-bold text-primary">{categoryData[0].name}</p>
            <p className="text-xs text-muted-foreground">
              {Math.round((categoryData[0].value / totalVideos) * 100)}% of all videos
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContentCategoryChart;
