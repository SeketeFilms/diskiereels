import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Calendar, TrendingUp, TrendingDown } from 'lucide-react';

interface DailyUsage {
  day: string;
  date: string;
  minutes: number;
}

interface WeeklyScreenTimeChartProps {
  userId: string;
}

const WeeklyScreenTimeChart = ({ userId }: WeeklyScreenTimeChartProps) => {
  const [weeklyData, setWeeklyData] = useState<DailyUsage[]>([]);
  const [totalMinutes, setTotalMinutes] = useState(0);
  const [avgMinutes, setAvgMinutes] = useState(0);
  const [trend, setTrend] = useState<'up' | 'down' | 'stable'>('stable');

  useEffect(() => {
    loadWeeklyData();
  }, [userId]);

  const loadWeeklyData = () => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const data: DailyUsage[] = [];
    const today = new Date();
    
    // Get last 7 days including today
    for (let i = 6; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = date.toDateString();
      const dayName = days[date.getDay()];
      
      // Get usage from localStorage
      const usageKey = `screen_time_${userId}_${dateString}`;
      const minutes = parseInt(localStorage.getItem(usageKey) || '0', 10);
      
      data.push({
        day: dayName,
        date: dateString,
        minutes: minutes,
      });
    }
    
    setWeeklyData(data);
    
    // Calculate stats
    const total = data.reduce((sum, d) => sum + d.minutes, 0);
    setTotalMinutes(total);
    setAvgMinutes(Math.round(total / 7));
    
    // Calculate trend (compare last 3 days to first 3 days)
    const firstHalf = data.slice(0, 3).reduce((s, d) => s + d.minutes, 0);
    const lastHalf = data.slice(4, 7).reduce((s, d) => s + d.minutes, 0);
    
    if (lastHalf > firstHalf * 1.1) {
      setTrend('up');
    } else if (lastHalf < firstHalf * 0.9) {
      setTrend('down');
    } else {
      setTrend('stable');
    }
  };

  const formatTime = (minutes: number) => {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const maxMinutes = Math.max(...weeklyData.map(d => d.minutes), 1);

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="bg-popover text-popover-foreground p-2 rounded-lg shadow-lg border border-border text-xs">
        <p className="font-semibold">{payload[0]?.payload?.date}</p>
        <p className="text-primary">{formatTime(payload[0]?.value || 0)}</p>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          Weekly Screen Time
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <p className="text-lg font-black">{formatTime(totalMinutes)}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <p className="text-lg font-black">{formatTime(avgMinutes)}</p>
            <p className="text-[10px] text-muted-foreground">Daily Avg</p>
          </div>
          <div className="text-center p-2 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center gap-1">
              {trend === 'up' && <TrendingUp className="h-4 w-4 text-destructive" />}
              {trend === 'down' && <TrendingDown className="h-4 w-4 text-green-500" />}
              {trend === 'stable' && <span className="text-lg">→</span>}
              <span className="text-lg font-black capitalize">{trend}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Trend</p>
          </div>
        </div>

        {/* Bar Chart */}
        <div className="h-32">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
              <XAxis 
                dataKey="day" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} 
              />
              <YAxis 
                hide 
                domain={[0, maxMinutes * 1.1]} 
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="minutes" radius={[4, 4, 0, 0]}>
                {weeklyData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={
                      index === weeklyData.length - 1 
                        ? 'hsl(var(--primary))' 
                        : 'hsl(var(--muted-foreground) / 0.3)'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">
          Today is highlighted. Data stored locally on device.
        </p>
      </CardContent>
    </Card>
  );
};

export default WeeklyScreenTimeChart;
