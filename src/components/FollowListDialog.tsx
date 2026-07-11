import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Loader2, BadgeCheck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';

const PAGE_SIZE = 20;

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

  const fetchPage = useCallback(async (targetPage: number) => {
    if (!userId) return;
    setLoading(true);
    const from = targetPage * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    const selectRelation = mode === 'followers'
      ? 'follower_id, profiles:follower_id ( id, username, avatar_url, is_verified )'
      : 'following_id, profiles:following_id ( id, username, avatar_url, is_verified )';
    const filterCol = mode === 'followers' ? 'following_id' : 'follower_id';

    const { data, error } = await supabase
      .from('follows')
      .select(selectRelation)
      .eq(filterCol, userId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      const list = data.map((row: any) => {
        const p = row.profiles;
        return {
          id: p?.id || row[mode === 'followers' ? 'follower_id' : 'following_id'],
          username: p?.username || 'Unknown',
          avatar_url: p?.avatar_url || null,
          is_verified: !!p?.is_verified,
        };
      });
      setUsers(prev => targetPage === 0 ? list : [...prev, ...list]);
      setHasMore(list.length === PAGE_SIZE);
    }
    setLoading(false);
  }, [userId, mode]);

  useEffect(() => {
    if (open) {
      setUsers([]);
      setPage(0);
      setHasMore(true);
      fetchPage(0);
    }
  }, [open, fetchPage]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchPage(next);
  };

  const title = mode === 'followers' ? 'Followers' : 'Following';
  const description = mode === 'followers'
    ? `People who follow this account (${totalCount})`
    : `Accounts this user follows (${totalCount})`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto space-y-2 -mx-1 px-1">
          {users.length === 0 && !loading && (
            <p className="text-center text-muted-foreground py-8 text-sm">
              {mode === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            </p>
          )}
          {users.map(u => (
            <button
              key={u.id}
              onClick={() => {
                onOpenChange(false);
                navigate(`/profile?userId=${u.id}`);
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
