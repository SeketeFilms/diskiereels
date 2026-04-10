import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ResponsiveLayout from '@/components/ResponsiveLayout';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowLeft, Star, Trophy, Crown, Medal } from 'lucide-react';

interface LeaderboardEntry {
  user_id: string;
  amount: number;
  username: string;
  avatar_url: string | null;
  selected_avatar: string | null;
  is_verified: boolean;
}

const RANK_ICONS = [Crown, Trophy, Medal];
const RANK_COLORS = ['text-yellow-500', 'text-muted-foreground', 'text-orange-600'];

const Leaderboard = () => {
  const navigate = useNavigate();
  const [topEarners, setTopEarners] = useState<LeaderboardEntry[]>([]);
  const [topGifters, setTopGifters] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboards();
  }, []);

  const fetchLeaderboards = async () => {
    try {
      // Top earners - creators with most stars earned
      const { data: earners } = await supabase
        .from('creator_monetization')
        .select('user_id, total_stars_earned')
        .order('total_stars_earned', { ascending: false })
        .limit(20);

      // Top gifters - users who spent most stars
      const { data: gifters } = await supabase
        .from('star_balances')
        .select('user_id, total_spent')
        .order('total_spent', { ascending: false })
        .limit(20);

      // Get profile info for all users
      const allUserIds = [
        ...(earners?.map(e => e.user_id) || []),
        ...(gifters?.map(g => g.user_id) || []),
      ];
      const uniqueIds = [...new Set(allUserIds)];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, selected_avatar, is_verified')
        .in('id', uniqueIds);

      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);

      setTopEarners(
        (earners || [])
          .filter(e => (e.total_stars_earned ?? 0) > 0)
          .map(e => {
            const p = profileMap.get(e.user_id);
            return {
              user_id: e.user_id,
              amount: e.total_stars_earned ?? 0,
              username: p?.username || 'Unknown',
              avatar_url: p?.avatar_url || null,
              selected_avatar: p?.selected_avatar || null,
              is_verified: p?.is_verified || false,
            };
          })
      );

      setTopGifters(
        (gifters || [])
          .filter(g => (g.total_spent ?? 0) > 0)
          .map(g => {
            const p = profileMap.get(g.user_id);
            return {
              user_id: g.user_id,
              amount: g.total_spent ?? 0,
              username: p?.username || 'Unknown',
              avatar_url: p?.avatar_url || null,
              selected_avatar: p?.selected_avatar || null,
              is_verified: p?.is_verified || false,
            };
          })
      );
    } catch (err) {
      console.error('Leaderboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  const renderList = (entries: LeaderboardEntry[], label: string) => (
    <div className="space-y-2">
      {entries.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Star className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm">No {label} yet. Be the first!</p>
        </div>
      ) : (
        entries.map((entry, i) => {
          const RankIcon = RANK_ICONS[i] || null;
          return (
            <button
              key={entry.user_id}
              onClick={() => navigate(`/profile/${entry.user_id}`)}
              className="w-full flex items-center gap-3 p-3 rounded-xl bg-card border border-border hover:border-primary/30 transition-all"
            >
              {/* Rank */}
              <div className="w-8 text-center font-black text-lg flex-shrink-0">
                {RankIcon ? (
                  <RankIcon className={`h-6 w-6 mx-auto ${RANK_COLORS[i]}`} />
                ) : (
                  <span className="text-muted-foreground">{i + 1}</span>
                )}
              </div>

              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg overflow-hidden flex-shrink-0 border-2 border-border">
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  entry.selected_avatar || '🦊'
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0 text-left">
                <p className="font-bold text-sm truncate text-foreground">
                  @{entry.username}
                  {entry.is_verified && <span className="ml-1 text-primary">✓</span>}
                </p>
              </div>

              {/* Amount */}
              <div className="flex items-center gap-1 flex-shrink-0">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                <span className="font-black text-sm">{entry.amount.toLocaleString()}</span>
              </div>
            </button>
          );
        })
      )}
    </div>
  );

  return (
    <ResponsiveLayout>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            Stars Leaderboard
          </h1>
        </div>

        <div className="p-4 max-w-lg mx-auto">
          <Tabs defaultValue="earners">
            <TabsList className="w-full">
              <TabsTrigger value="earners" className="flex-1 text-xs">⭐ Top Earners</TabsTrigger>
              <TabsTrigger value="gifters" className="flex-1 text-xs">🎁 Top Gifters</TabsTrigger>
            </TabsList>
            <TabsContent value="earners" className="mt-4">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                renderList(topEarners, 'earners')
              )}
            </TabsContent>
            <TabsContent value="gifters" className="mt-4">
              {loading ? (
                <div className="flex justify-center py-12">
                  <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
                </div>
              ) : (
                renderList(topGifters, 'gifters')
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </ResponsiveLayout>
  );
};

export default Leaderboard;
