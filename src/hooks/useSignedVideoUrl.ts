import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export const useSignedVideoUrl = (videoUrl: string | null) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!videoUrl) {
      setLoading(false);
      return;
    }

    const fetchSignedUrl = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data, error: functionError } = await supabase.functions.invoke('get-video-url', {
          body: { video_url: videoUrl }
        });

        if (functionError) {
          console.error('Failed to get signed URL:', functionError);
          setError(functionError.message);
          return;
        }

        if (data?.signed_url) {
          setSignedUrl(data.signed_url);
        }
      } catch (err) {
        console.error('Error fetching signed URL:', err);
        setError('Failed to load video');
      } finally {
        setLoading(false);
      }
    };

    fetchSignedUrl();
  }, [videoUrl]);

  return { signedUrl, loading, error };
};
