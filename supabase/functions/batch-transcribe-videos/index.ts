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

interface SubtitleSegment {
  id: number;
  text: string;
  start: number;
  end: number;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const elevenlabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');

    if (!elevenlabsApiKey) {
      return new Response(
        JSON.stringify({ error: 'ElevenLabs API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get optional videoId from request body
    let specificVideoId: string | null = null;
    try {
      const body = await req.json();
      specificVideoId = body?.videoId || null;
    } catch {
      // No body or invalid JSON, process all videos
    }

    // Find videos without subtitles
    let query = supabase
      .from('videos')
      .select('id, title, video_url, transcription_status')
      .is('subtitles', null);

    if (specificVideoId) {
      query = query.eq('id', specificVideoId);
    } else {
      query = query.or('transcription_status.is.null,transcription_status.eq.failed');
    }

    const { data: videos, error: fetchError } = await query.limit(10);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: 'Failed to fetch videos', details: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!videos || videos.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No videos need transcription', processed: 0 }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${videos.length} videos to transcribe`);

    const results: { videoId: string; title: string; status: string; error?: string }[] = [];

    for (const video of videos) {
      try {
        console.log(`Processing: ${video.title} (${video.id})`);

        // Update status to processing
        await supabase
          .from('videos')
          .update({ transcription_status: 'processing' })
          .eq('id', video.id);

        // Extract storage path from URL
        const storagePath = extractStoragePath(video.video_url);
        if (!storagePath) {
          await supabase
            .from('videos')
            .update({ transcription_status: 'failed' })
            .eq('id', video.id);
          results.push({ videoId: video.id, title: video.title, status: 'failed', error: 'Invalid URL format' });
          continue;
        }

        // Download the video file
        const { data: videoData, error: downloadError } = await supabase.storage
          .from('videos')
          .download(storagePath);

        if (downloadError || !videoData) {
          console.error(`Download failed for ${video.id}:`, downloadError);
          await supabase
            .from('videos')
            .update({ transcription_status: 'failed' })
            .eq('id', video.id);
          results.push({ videoId: video.id, title: video.title, status: 'failed', error: 'Download failed' });
          continue;
        }

        console.log(`Downloaded ${video.title}, size: ${videoData.size} bytes`);

        // Send to ElevenLabs for transcription
        const formData = new FormData();
        formData.append('file', videoData, 'video.mp4');
        formData.append('model_id', 'scribe_v1');
        formData.append('tag_audio_events', 'false');
        formData.append('diarize', 'false');

        const transcriptionResponse = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
          method: 'POST',
          headers: {
            'xi-api-key': elevenlabsApiKey,
          },
          body: formData,
        });

        if (!transcriptionResponse.ok) {
          const errorText = await transcriptionResponse.text();
          console.error(`ElevenLabs error for ${video.id}:`, errorText);
          await supabase
            .from('videos')
            .update({ transcription_status: 'failed' })
            .eq('id', video.id);
          results.push({ videoId: video.id, title: video.title, status: 'failed', error: 'ElevenLabs API error' });
          continue;
        }

        const transcription: TranscriptionResponse = await transcriptionResponse.json();
        console.log(`Transcription complete for ${video.title}: ${transcription.words?.length || 0} words`);

        // Convert to subtitle format
        const subtitles = groupWordsIntoSubtitles(transcription.words || []);

        // Update video with subtitles
        const { error: updateError } = await supabase
          .from('videos')
          .update({
            subtitles: subtitles,
            transcription_status: 'completed'
          })
          .eq('id', video.id);

        if (updateError) {
          console.error(`Save failed for ${video.id}:`, updateError);
          results.push({ videoId: video.id, title: video.title, status: 'failed', error: 'Save failed' });
        } else {
          results.push({ videoId: video.id, title: video.title, status: 'completed' });
        }

      } catch (error) {
        console.error(`Error processing ${video.id}:`, error);
        await supabase
          .from('videos')
          .update({ transcription_status: 'failed' })
          .eq('id', video.id);
        results.push({ 
          videoId: video.id, 
          title: video.title, 
          status: 'failed', 
          error: error instanceof Error ? error.message : 'Unknown error' 
        });
      }
    }

    const completed = results.filter(r => r.status === 'completed').length;
    const failed = results.filter(r => r.status === 'failed').length;

    return new Response(
      JSON.stringify({
        message: `Processed ${results.length} videos`,
        completed,
        failed,
        results
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Batch transcription error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: 'Batch transcription failed', details: message }),
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

function groupWordsIntoSubtitles(words: TranscriptionWord[]): SubtitleSegment[] {
  if (!words || words.length === 0) return [];

  const subtitles: SubtitleSegment[] = [];
  let currentSegment: TranscriptionWord[] = [];
  let segmentId = 1;
  const maxWordsPerSegment = 8;
  const maxDurationPerSegment = 4;

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
