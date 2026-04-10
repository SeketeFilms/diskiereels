import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TranscriptionWord {
  text: string;
  start: number;
  end: number;
}

interface TranscriptionResponse {
  text: string;
  words: TranscriptionWord[];
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');

    if (!elevenlabsApiKey) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);
    
    if (claimsError || !claimsData?.claims) {
      return new Response(
        JSON.stringify({ error: 'Invalid token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const userId = claimsData.claims.sub;

    const { videoId, videoUrl } = await req.json();

    if (!videoId || !videoUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing videoId or videoUrl' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify the user owns this video
    const { data: video, error: videoError } = await supabase
      .from('videos')
      .select('creator_id, transcription_status')
      .eq('id', videoId)
      .single();

    if (videoError || !video) {
      return new Response(
        JSON.stringify({ error: 'Video not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (video.creator_id !== userId) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: You do not own this video' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing
    await supabase
      .from('videos')
      .update({ transcription_status: 'processing' })
      .eq('id', videoId);

    console.log(`Starting transcription for video ${videoId}`);

    // Extract storage path from URL
    const storagePath = extractStoragePath(videoUrl);
    if (!storagePath) {
      await supabase
        .from('videos')
        .update({ transcription_status: 'failed' })
        .eq('id', videoId);
      
      return new Response(
        JSON.stringify({ error: 'Invalid video URL format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Download the video file from storage
    const { data: videoData, error: downloadError } = await supabase.storage
      .from('videos')
      .download(storagePath);

    if (downloadError || !videoData) {
      console.error('Failed to download video:', downloadError);
      await supabase
        .from('videos')
        .update({ transcription_status: 'failed' })
        .eq('id', videoId);
      
      return new Response(
        JSON.stringify({ error: 'Failed to download video file' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Downloaded video, size: ${videoData.size} bytes`);

    // Send to ElevenLabs for transcription
    const formData = new FormData();
    formData.append('file', videoData, 'video.mp4');
    formData.append('model_id', 'scribe_v1');
    formData.append('tag_audio_events', 'false');
    formData.append('diarize', 'false');

    console.log('Sending to ElevenLabs STT API...');

    const transcriptionResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: {
        'xi-api-key': elevenlabsApiKey,
      },
      body: formData,
    });

    if (!transcriptionResponse.ok) {
      const errorText = await transcriptionResponse.text();
      console.error('ElevenLabs API error:', errorText);
      
      await supabase
        .from('videos')
        .update({ transcription_status: 'failed' })
        .eq('id', videoId);
      
      return new Response(
        JSON.stringify({ error: 'Transcription failed', details: errorText }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transcription: TranscriptionResponse = await transcriptionResponse.json();
    console.log(`Transcription complete: ${transcription.words?.length || 0} words`);

    // Convert words to subtitle format (group into segments)
    const subtitles = groupWordsIntoSubtitles(transcription.words || []);

    // Update video with subtitles
    const { error: updateError } = await supabase
      .from('videos')
      .update({
        subtitles: subtitles,
        transcription_status: 'completed'
      })
      .eq('id', videoId);

    if (updateError) {
      console.error('Failed to save subtitles:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to save subtitles' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        subtitleCount: subtitles.length,
        fullText: transcription.text
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Transcription error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Transcription failed', details: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function extractStoragePath(url: string): string | null {
  if (!url) return null;
  
  const patterns = [
    /\/storage\/v1\/object\/public\/videos\/(.+)/,
    /\/storage\/v1\/object\/sign\/videos\/(.+)\?/,
    /videos\/(.+)$/
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return decodeURIComponent(match[1].split('?')[0]);
  }

  return null;
}

interface SubtitleSegment {
  id: number;
  text: string;
  start: number;
  end: number;
}

function groupWordsIntoSubtitles(words: TranscriptionWord[]): SubtitleSegment[] {
  if (!words || words.length === 0) return [];

  const subtitles: SubtitleSegment[] = [];
  let currentSegment: TranscriptionWord[] = [];
  let segmentId = 1;
  const maxWordsPerSegment = 8;
  const maxDurationPerSegment = 4; // seconds

  for (const word of words) {
    currentSegment.push(word);

    const segmentDuration = word.end - (currentSegment[0]?.start || 0);
    const shouldSplit = 
      currentSegment.length >= maxWordsPerSegment ||
      segmentDuration >= maxDurationPerSegment ||
      word.text.match(/[.!?]$/);

    if (shouldSplit && currentSegment.length > 0) {
      subtitles.push({
        id: segmentId++,
        text: currentSegment.map(w => w.text).join(' '),
        start: currentSegment[0].start,
        end: word.end
      });
      currentSegment = [];
    }
  }

  // Add remaining words
  if (currentSegment.length > 0) {
    subtitles.push({
      id: segmentId,
      text: currentSegment.map(w => w.text).join(' '),
      start: currentSegment[0].start,
      end: currentSegment[currentSegment.length - 1].end
    });
  }

  return subtitles;
}
