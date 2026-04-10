import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import ResponsiveLayout from '@/components/ResponsiveLayout';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Star, TrendingUp, Lock, CheckCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { Progress } from '@/components/ui/progress';

interface MonetizationData {
  is_eligible: boolean;
  total_stars_earned: number;
  total_withdrawn: number;
  pending_balance: number;
  revenue_split_creator: number;
  revenue_split_platform: number;
}

interface Transaction {
  id: string;
  from_user_id: string | null;
  amount: number;
  type: string;
  created_at: string;
}

const ELIGIBILITY_FOLLOWERS = 5000;
const ELIGIBILITY_WATCH_HOURS = 1000000;

const StarsDashboard = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');
  const [monetization, setMonetization] = useState<MonetizationData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [starBalance, setStarBalance] = useState(0);
  const [followers, setFollowers] = useState(0);
  const [totalWatchHours, setTotalWatchHours] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { navigate('/auth'); return; }
    
    const uid = session.user.id;
    setUserId(uid);

    const [balRes, monRes, txRes, follRes, vidRes] = await Promise.all([
      supabase.from('star_balances').select('balance').eq('user_id', uid).maybeSingle(),
      supabase.from('creator_monetization').select('*').eq('user_id', uid).maybeSingle(),
      supabase.from('star_transactions').select('*').eq('to_user_id', uid).order('created_at', { ascending: false }).limit(20),
      supabase.from('follows').select('id', { count: 'exact' }).eq('following_id', uid),
      supabase.from('videos').select('id').eq('creator_id', uid),
    ]);

    const videoIds = (vidRes.data as any[])?.map((v: any) => v.id) || [];
    let watchHours = 0;
    if (videoIds.length > 0) {
      const { data: analytics } = await supabase
        .from('video_analytics')
        .select('watch_duration')
        .in('video_id', videoIds);
      const totalSec = (analytics as any[])?.reduce((s: number, a: any) => s + (a.watch_duration || 0), 0) || 0;
      watchHours = Math.round(totalSec / 3600);
    }

    setStarBalance((balRes.data as any)?.balance || 0);
    setMonetization(monRes.data as any);
    setTransactions((txRes.data as any[]) || []);
    setFollowers(follRes.count || 0);
    setTotalWatchHours(watchHours);
    setIsLoading(false);
  };

  const checkEligibility = async () => {
    const eligible = followers >= ELIGIBILITY_FOLLOWERS && totalWatchHours >= ELIGIBILITY_WATCH_HOURS;
    
    const { data: existing } = await supabase
      .from('creator_monetization')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from('creator_monetization')
        .update({ is_eligible: eligible, eligibility_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq('user_id', userId);
    } else {
      await supabase
        .from('creator_monetization')
        .insert({ user_id: userId, is_eligible: eligible });
    }

    setMonetization(prev => prev ? { ...prev, is_eligible: eligible } : {
      is_eligible: eligible, total_stars_earned: 0, total_withdrawn: 0,
      pending_balance: 0, revenue_split_creator: 70, revenue_split_platform: 30
    });

    toast[eligible ? 'success' : 'info'](
      eligible ? 'You are eligible for monetization! 🎉' : 'Not eligible yet. Keep growing!'
    );
  };

  const followerProgress = Math.min((followers / ELIGIBILITY_FOLLOWERS) * 100, 100);
  const watchHoursProgress = Math.min((totalWatchHours / ELIGIBILITY_WATCH_HOURS) * 100, 100);

  if (isLoading) {
    return (
      <ResponsiveLayout>
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin h-8 w-8 border-2 border-primary border-t-transparent rounded-full" />
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="min-h-screen bg-background pb-24">
        {/* Header */}
        <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-md border-b border-border px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            Stars Dashboard
          </h1>
        </div>

        <div className="p-4 space-y-4 max-w-lg mx-auto">
          {/* Balance Card */}
          <div className="bg-gradient-to-br from-yellow-500/20 to-orange-500/20 rounded-2xl p-5 border border-yellow-500/30">
            <p className="text-sm text-muted-foreground mb-1">Your Star Balance</p>
            <div className="flex items-center gap-2">
              <Star className="h-8 w-8 text-yellow-500 fill-yellow-500" />
              <span className="text-4xl font-black">{starBalance.toLocaleString()}</span>
            </div>
            {monetization?.is_eligible && (
              <div className="mt-3 pt-3 border-t border-yellow-500/20">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Pending earnings</span>
                  <span className="font-bold">{monetization.pending_balance} ⭐</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Total earned</span>
                  <span className="font-bold">{monetization.total_stars_earned} ⭐</span>
                </div>
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-muted-foreground">Revenue split</span>
                  <span className="font-bold text-primary">{monetization.revenue_split_creator}% you / {monetization.revenue_split_platform}% platform</span>
                </div>
              </div>
            )}
          </div>

          {/* Eligibility Section */}
          <div className="bg-card rounded-2xl p-5 border border-border">
            <div className="flex items-center gap-2 mb-4">
              {monetization?.is_eligible ? (
                <CheckCircle className="h-5 w-5 text-green-500" />
              ) : (
                <Lock className="h-5 w-5 text-muted-foreground" />
              )}
              <h2 className="font-bold">Monetization Status</h2>
            </div>

            {monetization?.is_eligible ? (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <p className="text-sm font-medium text-green-600 dark:text-green-400">
                  ✅ You're eligible! Stars gifted to you count towards your earnings.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      Reach {ELIGIBILITY_FOLLOWERS.toLocaleString()} followers and {ELIGIBILITY_WATCH_HOURS.toLocaleString()} watch hours to start earning from Stars.
                    </p>
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Followers</span>
                    <span className="font-medium">{followers.toLocaleString()} / {ELIGIBILITY_FOLLOWERS.toLocaleString()}</span>
                  </div>
                  <Progress value={followerProgress} className="h-2" />
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Watch Hours</span>
                    <span className="font-medium">{totalWatchHours.toLocaleString()} / {ELIGIBILITY_WATCH_HOURS.toLocaleString()}</span>
                  </div>
                  <Progress value={watchHoursProgress} className="h-2" />
                </div>

                <Button onClick={checkEligibility} className="w-full" size="sm">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Check Eligibility
                </Button>
              </div>
            )}
          </div>

          {/* How it works */}
          <div className="bg-card rounded-2xl p-5 border border-border">
            <h2 className="font-bold mb-3">How Stars Work</h2>
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="flex gap-3">
                <span className="text-lg">🌟</span>
                <p>Viewers buy Star packs and send them to creators on toonz they love.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-lg">📊</span>
                <p>Reach {ELIGIBILITY_FOLLOWERS.toLocaleString()} followers + {ELIGIBILITY_WATCH_HOURS.toLocaleString()} watch hours to unlock monetization.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-lg">💰</span>
                <p>Eligible creators earn 70% of gifted Stars value. Platform keeps 30%.</p>
              </div>
              <div className="flex gap-3">
                <span className="text-lg">📈</span>
                <p>Track your earnings and Star gifts in real-time from this dashboard.</p>
              </div>
            </div>
          </div>

          {/* Recent Transactions */}
          <div className="bg-card rounded-2xl p-5 border border-border">
            <h2 className="font-bold mb-3">Recent Star Gifts</h2>
            {transactions.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No star gifts yet</p>
            ) : (
              <div className="space-y-2">
                {transactions.map(tx => (
                  <div key={tx.id} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-sm capitalize">{tx.type}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-primary">+{tx.amount}</span>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </ResponsiveLayout>
  );
};

export default StarsDashboard;
