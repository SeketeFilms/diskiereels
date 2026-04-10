import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Trophy, Heart, Users, Video, Lock, Eye } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import ResponsiveLayout from '@/components/ResponsiveLayout';

interface MilestoneBadge {
  id: string;
  type: 'likes' | 'followers' | 'uploads' | 'views';
  value: number;
  label: string;
  icon: React.ReactNode;
  achieved: boolean;
  color: string;
}

const STORAGE_KEY = 'toonlyreels_achieved_milestones';

const getAchievedMilestones = (): Record<string, number[]> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : { likes: [], followers: [], uploads: [], views: [] };
  } catch {
    return { likes: [], followers: [], uploads: [], views: [] };
  }
};

const formatNumber = (num: number): string => {
  if (num >= 1000000) return `${num / 1000000}M`;
  if (num >= 1000) return `${num / 1000}K`;
  return num.toString();
};

const Milestones = () => {
  const navigate = useNavigate();
  const [achievedMilestones, setAchievedMilestones] = useState<Record<string, number[]>>({ likes: [], followers: [], uploads: [], views: [] });

  useEffect(() => {
    setAchievedMilestones(getAchievedMilestones());
  }, []);

  const allMilestones: MilestoneBadge[] = [
    // Likes milestones
    { id: 'likes-1000', type: 'likes', value: 1000, label: '1K Likes', icon: <Heart className="w-6 h-6" />, achieved: achievedMilestones.likes?.includes(1000), color: 'from-red-500 to-pink-500' },
    { id: 'likes-10000', type: 'likes', value: 10000, label: '10K Likes', icon: <Heart className="w-6 h-6" />, achieved: achievedMilestones.likes?.includes(10000), color: 'from-red-500 to-pink-500' },
    { id: 'likes-50000', type: 'likes', value: 50000, label: '50K Likes', icon: <Heart className="w-6 h-6" />, achieved: achievedMilestones.likes?.includes(50000), color: 'from-red-500 to-pink-500' },
    { id: 'likes-100000', type: 'likes', value: 100000, label: '100K Likes', icon: <Heart className="w-6 h-6" />, achieved: achievedMilestones.likes?.includes(100000), color: 'from-red-500 to-pink-500' },
    { id: 'likes-200000', type: 'likes', value: 200000, label: '200K Likes', icon: <Heart className="w-6 h-6" />, achieved: achievedMilestones.likes?.includes(200000), color: 'from-red-500 to-pink-500' },
    { id: 'likes-500000', type: 'likes', value: 500000, label: '500K Likes', icon: <Heart className="w-6 h-6" />, achieved: achievedMilestones.likes?.includes(500000), color: 'from-red-500 to-pink-500' },
    { id: 'likes-20000000', type: 'likes', value: 20000000, label: '20M Likes', icon: <Heart className="w-6 h-6" />, achieved: achievedMilestones.likes?.includes(20000000), color: 'from-red-500 to-pink-500' },
    
    // Views milestones
    { id: 'views-1000', type: 'views', value: 1000, label: '1K Views', icon: <Eye className="w-6 h-6" />, achieved: achievedMilestones.views?.includes(1000), color: 'from-amber-500 to-yellow-500' },
    { id: 'views-10000', type: 'views', value: 10000, label: '10K Views', icon: <Eye className="w-6 h-6" />, achieved: achievedMilestones.views?.includes(10000), color: 'from-amber-500 to-yellow-500' },
    { id: 'views-50000', type: 'views', value: 50000, label: '50K Views', icon: <Eye className="w-6 h-6" />, achieved: achievedMilestones.views?.includes(50000), color: 'from-amber-500 to-yellow-500' },
    { id: 'views-100000', type: 'views', value: 100000, label: '100K Views', icon: <Eye className="w-6 h-6" />, achieved: achievedMilestones.views?.includes(100000), color: 'from-amber-500 to-yellow-500' },
    { id: 'views-200000', type: 'views', value: 200000, label: '200K Views', icon: <Eye className="w-6 h-6" />, achieved: achievedMilestones.views?.includes(200000), color: 'from-amber-500 to-yellow-500' },
    { id: 'views-500000', type: 'views', value: 500000, label: '500K Views', icon: <Eye className="w-6 h-6" />, achieved: achievedMilestones.views?.includes(500000), color: 'from-amber-500 to-yellow-500' },
    { id: 'views-20000000', type: 'views', value: 20000000, label: '20M Views', icon: <Eye className="w-6 h-6" />, achieved: achievedMilestones.views?.includes(20000000), color: 'from-amber-500 to-yellow-500' },
    
    // Followers milestones
    { id: 'followers-1000', type: 'followers', value: 1000, label: '1K Followers', icon: <Users className="w-6 h-6" />, achieved: achievedMilestones.followers?.includes(1000), color: 'from-blue-500 to-purple-500' },
    { id: 'followers-10000', type: 'followers', value: 10000, label: '10K Followers', icon: <Users className="w-6 h-6" />, achieved: achievedMilestones.followers?.includes(10000), color: 'from-blue-500 to-purple-500' },
    { id: 'followers-50000', type: 'followers', value: 50000, label: '50K Followers', icon: <Users className="w-6 h-6" />, achieved: achievedMilestones.followers?.includes(50000), color: 'from-blue-500 to-purple-500' },
    { id: 'followers-100000', type: 'followers', value: 100000, label: '100K Followers', icon: <Users className="w-6 h-6" />, achieved: achievedMilestones.followers?.includes(100000), color: 'from-blue-500 to-purple-500' },
    { id: 'followers-200000', type: 'followers', value: 200000, label: '200K Followers', icon: <Users className="w-6 h-6" />, achieved: achievedMilestones.followers?.includes(200000), color: 'from-blue-500 to-purple-500' },
    { id: 'followers-500000', type: 'followers', value: 500000, label: '500K Followers', icon: <Users className="w-6 h-6" />, achieved: achievedMilestones.followers?.includes(500000), color: 'from-blue-500 to-purple-500' },
    { id: 'followers-20000000', type: 'followers', value: 20000000, label: '20M Followers', icon: <Users className="w-6 h-6" />, achieved: achievedMilestones.followers?.includes(20000000), color: 'from-blue-500 to-purple-500' },
    
    // Uploads milestones
    { id: 'uploads-500', type: 'uploads', value: 500, label: '500 Reels', icon: <Video className="w-6 h-6" />, achieved: achievedMilestones.uploads?.includes(500), color: 'from-green-500 to-emerald-500' },
    { id: 'uploads-1000', type: 'uploads', value: 1000, label: '1K Reels', icon: <Video className="w-6 h-6" />, achieved: achievedMilestones.uploads?.includes(1000), color: 'from-green-500 to-emerald-500' },
    { id: 'uploads-50000', type: 'uploads', value: 50000, label: '50K Reels', icon: <Video className="w-6 h-6" />, achieved: achievedMilestones.uploads?.includes(50000), color: 'from-green-500 to-emerald-500' },
    { id: 'uploads-1000000', type: 'uploads', value: 1000000, label: '1M Reels', icon: <Video className="w-6 h-6" />, achieved: achievedMilestones.uploads?.includes(1000000), color: 'from-green-500 to-emerald-500' },
  ];

  const achievedCount = allMilestones.filter(m => m.achieved).length;
  const totalCount = allMilestones.length;

  const groupedMilestones = {
    likes: allMilestones.filter(m => m.type === 'likes'),
    views: allMilestones.filter(m => m.type === 'views'),
    followers: allMilestones.filter(m => m.type === 'followers'),
    uploads: allMilestones.filter(m => m.type === 'uploads'),
  };

  return (
    <ResponsiveLayout>
      <div className="min-h-screen bg-background pb-20 md:pb-4">
        {/* Header */}
        <div className="sticky top-0 z-40 bg-background/95 backdrop-blur-sm border-b border-border">
          <div className="flex items-center gap-4 p-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="md:hidden">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">Milestone Badges</h1>
            <p className="text-sm text-muted-foreground">{achievedCount} of {totalCount} achieved</p>
          </div>
          <div className="flex items-center gap-2 bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1.5 rounded-full">
            <Trophy className="w-4 h-4" />
            <span className="font-bold">{achievedCount}</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-8">
        {/* Likes Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Heart className="w-5 h-5 text-red-500" />
            <h2 className="text-lg font-semibold">Likes Milestones</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {groupedMilestones.likes.map((milestone) => (
              <MilestoneBadgeCard key={milestone.id} milestone={milestone} />
            ))}
          </div>
        </section>

        {/* Views Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Eye className="w-5 h-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Views Milestones</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {groupedMilestones.views.map((milestone) => (
              <MilestoneBadgeCard key={milestone.id} milestone={milestone} />
            ))}
          </div>
        </section>

        {/* Followers Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-blue-500" />
            <h2 className="text-lg font-semibold">Followers Milestones</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {groupedMilestones.followers.map((milestone) => (
              <MilestoneBadgeCard key={milestone.id} milestone={milestone} />
            ))}
          </div>
        </section>

        {/* Uploads Section */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <Video className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold">Uploads Milestones</h2>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
            {groupedMilestones.uploads.map((milestone) => (
              <MilestoneBadgeCard key={milestone.id} milestone={milestone} />
            ))}
          </div>
        </section>
      </div>

      </div>
    </ResponsiveLayout>
  );
};

const MilestoneBadgeCard = ({ milestone }: { milestone: MilestoneBadge }) => {
  return (
    <Card 
      className={`relative p-4 flex flex-col items-center justify-center aspect-square transition-all duration-300 ${
        milestone.achieved 
          ? 'bg-gradient-to-br ' + milestone.color + ' text-white shadow-lg scale-100' 
          : 'bg-muted/50 text-muted-foreground opacity-60'
      }`}
    >
      {!milestone.achieved && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 rounded-lg">
          <Lock className="w-6 h-6 text-muted-foreground" />
        </div>
      )}
      <div className={`mb-2 ${milestone.achieved ? 'animate-pulse' : ''}`}>
        {milestone.icon}
      </div>
      <span className="text-xs font-bold text-center leading-tight">
        {milestone.label}
      </span>
      {milestone.achieved && (
        <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full flex items-center justify-center shadow-md">
          <span className="text-xs">✓</span>
        </div>
      )}
    </Card>
  );
};

export default Milestones;
