/**
 * Maps a push notification payload to an in-app route so tapping a push opens
 * the exact reel, profile or comment that triggered it.
 */
export interface PushPayloadData {
  type?: string;
  video_id?: string | null;
  comment_id?: string | null;
  actor_id?: string | null;
  follower_id?: string | null;
  url?: string | null;
}

export const buildPushDeepLink = (data: PushPayloadData = {}): string => {
  // An explicit url always wins (relative paths only, for safety).
  if (data.url && data.url.startsWith('/')) return data.url;

  const actor = data.actor_id || data.follower_id;

  switch (data.type) {
    case 'follow':
      return actor ? `/profile/${actor}` : '/notifications';
    case 'comment':
    case 'reply':
      if (data.video_id) {
        const q = new URLSearchParams({ video: data.video_id, comments: '1' });
        if (data.comment_id) q.set('comment', data.comment_id);
        return `/feed?${q.toString()}`;
      }
      return '/notifications';
    case 'like':
    case 'save':
    case 'share':
    case 'new_video':
    case 'star_gift':
      return data.video_id ? `/feed?video=${data.video_id}` : '/notifications';
    default:
      if (data.video_id) return `/feed?video=${data.video_id}`;
      return '/notifications';
  }
};
