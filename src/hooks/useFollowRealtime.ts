import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface FollowRow {
  follower_id: string;
  following_id: string;
}

export type FollowEvent = 'INSERT' | 'DELETE';

/**
 * Subscribes to realtime changes on the `follows` table and invokes the
 * callback for every follow/unfollow. Consumers filter for the rows they care
 * about, so follower/following state updates instantly app-wide.
 *
 * The callback is held in a ref so re-renders never re-subscribe.
 */
export const useFollowRealtime = (
  onChange: (row: FollowRow, event: FollowEvent) => void
) => {
  const handlerRef = useRef(onChange);
  handlerRef.current = onChange;

  useEffect(() => {
    const channel = supabase
      .channel(`follows-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'follows' },
        (payload) => {
          const row = payload.new as FollowRow;
          if (row?.follower_id && row?.following_id) handlerRef.current(row, 'INSERT');
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'follows' },
        (payload) => {
          const row = payload.old as FollowRow;
          if (row?.follower_id && row?.following_id) handlerRef.current(row, 'DELETE');
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
};
