import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, BadgeCheck, RefreshCw, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 20;
const MAX_AUTO_RETRIES = 2;

interface FollowUser {
  id: string;
  username: string;
  avatar_url: string | null;
  is_verified?: boolean;
}

interface FollowListDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  mode: 'followers' | 'following';
  totalCount: number;
}

const FollowListDialog = ({ open, onOpenChange, userId, mode, totalCount }: FollowListDialogProps) => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<FollowUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPage = useCallback(async (targetPage: number, attempt = 0): Promise<void> => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    const from = targetPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const filterCol = mode === 'followers' ? 'following_id' : 'follower_id';
    const userCol = mode === 'followers' ? 'follower_id' : 'following_id';

    try {
      const { data: follows, error: followsError } = await supabase
        .from('follows')
        .select(userCol)
        .eq(filterCol, userId)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (followsError) throw followsError;

      const ids = (follows || []).map((row: any) => row[userCol]).filter(Boolean);
      let profilesById = new Map<string, FollowUser>();

      if (ids.length > 0) {
        const { data: profiles, error: profErr } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, is_verified')
          .in('id', ids);
        if (profErr) throw profErr;

        profilesById = new Map(
          (profiles || []).map((p: any) => [
            p.id,
            {
              id: p.id,
              username: p.username || 'Unknown',
              avatar_url: p.avatar_url || null,
              is_verified: !!p.is_verified,
            },
          ])
        );
      }

      const list = ids.map((id: string) => profilesById.get(id) || {
        id, username: 'Unknown', avatar_url: null, is_verified: false,
      });

      setUsers(prev => targetPage === 0 ? list : [...prev, ...list]);
      setHasMore(list.length === PAGE_SIZE);

      // Auto-retry once if we expected results but got none on first page
      if (targetPage === 0 && list.length === 0 && totalCount > 0 && attempt < MAX_AUTO_RETRIES) {
        setTimeout(() => fetchPage(0, attempt + 1), 600);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load list');
      setHasMore(false);
      if (attempt < MAX_AUTO_RETRIES) {
        setTimeout(() => fetchPage(targetPage, attempt + 1), 800);
      }
    } finally {
      setLoading(false);
    }
  }, [userId, mode, totalCount]);

  useEffect(() => {
    if (open) {
      setUsers([]);
      setPage(0);
      setHasMore(true);
      setError(null);
      fetchPage(0);
    }
  }, [open, fetchPage]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  };

  const refresh = () => {
    setUsers([]);
    setPage(0);
    setHasMore(true);
    fetchPage(0);
  };

  const title = mode === 'followers' ? 'Followers' : 'Following';
  const description = mode === 'followers'
    ? `People who follow this account (${totalCount})`
    : `Accounts this user follows (${totalCount})`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <DialogTitle>{title}</DialogTitle>
              <DialogDescription>{description}</DialogDescription>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={refresh}
              disabled={loading}
              aria-label="Refresh"
              className="h-8 w-8 flex-shrink-0"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2 -mx-1 px-1">
          {error && (
            <div className="flex items-center gap-2 text-xs text-destructive bg-destructive/10 rounded-lg p-2">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">{error}</span>
              <Button size="sm" variant="outline" onClick={refresh}>Retry</Button>
            </div>
          )}
          {users.length === 0 && !loading && !error && (
            <div className="text-center py-8 space-y-3">
              <p className="text-sm text-muted-foreground">
                {mode === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
              </p>
              {totalCount > 0 && (
                <Button size="sm" variant="outline" onClick={refresh}>
                  <RefreshCw className="h-3.5 w-3.5 mr-2" /> Refresh
                </Button>
              )}
            </div>
          )}
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => {
                onOpenChange(false);
                navigate(`/profile/${u.id}`);
              }}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted transition-colors text-left"
            >
              <Avatar className="h-10 w-10">
                <AvatarImage src={u.avatar_url || undefined} />
                <AvatarFallback className="bg-primary text-primary-foreground font-bold">
                  {u.username[0]?.toUpperCase() || 'U'}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-sm flex items-center gap-1 truncate">
                @{u.username}
                {u.is_verified && <BadgeCheck className="h-4 w-4 text-primary flex-shrink-0" />}
              </span>
            </button>
          ))}
          {loading && (
            <div className="flex justify-center py-3">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && hasMore && users.length > 0 && (
            <div className="flex justify-center pt-2">
              <Button size="sm" variant="outline" onClick={loadMore}>Load more</Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FollowListDialog;
