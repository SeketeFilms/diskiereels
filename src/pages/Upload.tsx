import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Upload as UploadIcon, ArrowLeft, X, Hash, Stamp, RotateCcw, Lock } from 'lucide-react';
import ResponsiveLayout from '@/components/ResponsiveLayout';
import { toast } from 'sonner';

const Upload = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [applyWatermark, setApplyWatermark] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [roleChecking, setRoleChecking] = useState(true);
  const [isCreative, setIsCreative] = useState(false);
  const [debugLogs, setDebugLogs] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);
  const pushLog = (msg: string) => {
    const line = `[${new Date().toISOString().slice(11, 19)}] ${msg}`;
    console.log('[Upload]', line);
    setDebugLogs((prev) => [...prev, line].slice(-200));
  };

  // Enforce: only creatives can access the upload screen.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate('/auth'); return; }
      const { data: roles } = await supabase
        .from('user_roles').select('role').eq('user_id', user.id);
      const creative = roles?.some(r => r.role === 'creative') || false;
      if (!active) return;
      setIsCreative(creative);
      setRoleChecking(false);
    })();
    return () => { active = false; };
  }, [navigate]);

  const addHashtag = () => {
    const tag = hashtagInput.trim().replace(/^#/, '').toLowerCase();
    if (tag && !hashtags.includes(tag) && hashtags.length < 20) {
      setHashtags([...hashtags, tag]);
      setHashtagInput('');
    } else if (hashtags.length >= 20) {
      toast.error('Maximum 20 hashtags allowed');
    }
  };

  const removeHashtag = (tagToRemove: string) => {
    setHashtags(hashtags.filter(tag => tag !== tagToRemove));
  };

  const handleHashtagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      addHashtag();
    }
  };

  const generateThumbnail = (videoFile: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      
      video.onloadedmetadata = () => {
        video.currentTime = 0.5; // Get frame at 0.5 seconds
      };
      
      video.onseeked = () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          canvas.toBlob((blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Failed to generate thumbnail'));
            }
          }, 'image/jpeg', 0.8);
        } else {
          reject(new Error('Failed to get canvas context'));
        }
      };
      
      video.onerror = () => reject(new Error('Failed to load video'));
      video.src = URL.createObjectURL(videoFile);
    });
  };

  const validateVideoAspectRatio = (videoFile: File): Promise<boolean> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        const aspectRatio = video.videoWidth / video.videoHeight;
        URL.revokeObjectURL(video.src);
        // Accept any portrait video (taller than wide). Reject landscape/square.
        resolve(aspectRatio < 1);
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve(false);
      };
      
      video.src = URL.createObjectURL(videoFile);
    });
  };

  const validateVideoDuration = (videoFile: File): Promise<{ valid: boolean; duration: number }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      
      video.onloadedmetadata = () => {
        const duration = video.duration;
        URL.revokeObjectURL(video.src);
        resolve({ valid: duration <= 120, duration }); // Max 120 seconds (2 minutes)
      };
      
      video.onerror = () => {
        URL.revokeObjectURL(video.src);
        resolve({ valid: false, duration: 0 });
      };
      
      video.src = URL.createObjectURL(videoFile);
    });
  };

  // Extract hashtags from title
  const extractHashtags = (text: string): string[] => {
    const hashtagRegex = /#(\w+)/g;
    const matches = text.match(hashtagRegex);
    return matches ? matches.map(tag => tag.replace('#', '').toLowerCase()) : [];
  };

  // Trigger AI transcription in the background. Failures are silent — the reel
  // still uploads and plays without subtitles. Captions can be toggled in
  // Settings or per-reel via the player menu.
  const triggerTranscription = async (videoId: string, videoUrl: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ videoId, videoUrl }),
        }
      );

      if (response.ok) {
        const result = await response.json();
        console.log('Transcription complete:', result);
        toast.success('Subtitles ready for your reel!');
      } else {
        // Graceful fallback — don't block or alarm the user
        const errText = await response.text().catch(() => '');
        console.warn('Transcription unavailable, reel uploaded without subtitles:', errText);
      }
    } catch (error) {
      console.warn('Transcription skipped:', error);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Please enter a title');
      return;
    }
    if (!videoFile) {
      toast.error('Please select a video file');
      return;
    }

    // Validate file format
    const allowedFormats = ['mp4', 'webm', 'mov'];
    const fileExt = videoFile.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !allowedFormats.includes(fileExt)) {
      toast.error('Invalid video format. Only MP4, WebM, and MOV are supported.');
      return;
    }

    // Check file size (max 250MB)
    const maxSize = 250 * 1024 * 1024; // 250MB in bytes
    if (videoFile.size > maxSize) {
      toast.error('Video file is too large. Maximum size is 250MB');
      return;
    }

    // Validate orientation (must be portrait)
    toast.info('Validating video...');
    const isValidRatio = await validateVideoAspectRatio(videoFile);
    if (!isValidRatio) {
      toast.error('Only portrait videos are allowed. Please upload a vertical clip (not landscape).');
      return;
    }

    // Validate duration (max 2 minutes)
    const { valid: isValidDuration, duration } = await validateVideoDuration(videoFile);
    if (!isValidDuration) {
      toast.error(`Video is too long (${Math.floor(duration)}s). Maximum duration is 2 minutes (120s)`);
      return;
    }

    setLoading(true);
    setUploadProgress(0);
    setUploadFailed(false);
    setDebugLogs([]);
    setShowDebug(true);
    pushLog(`Starting upload: ${videoFile.name} (${(videoFile.size / 1024 / 1024).toFixed(2)} MB, type=${videoFile.type})`);
    pushLog(`Supabase URL: ${(import.meta as any).env?.VITE_SUPABASE_URL ?? 'unknown'}`);

    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      // Simulate progress based on estimated upload time
      const estimatedTimeMs = Math.min((videoFile.size / 1024 / 1024) * 1000, 60000); // ~1 second per MB, max 60s
      progressInterval = setInterval(() => {
        setUploadProgress((prev) => {
          if (prev >= 90) return prev; // Stop at 90% until actual upload completes
          return prev + 5;
        });
      }, estimatedTimeMs / 18); // Reach 90% gradually

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      pushLog(`Auth OK, user.id=${user.id}`);

      // Ensure profile exists (fixes foreign key constraint error)
      await supabase.rpc('ensure_current_user_profile');
      pushLog('Profile ensured');

      // Upload video to storage
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      pushLog(`Storage path: videos/${fileName}`);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('videos')
        .upload(fileName, videoFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (progressInterval) clearInterval(progressInterval);
      setUploadProgress(95);

      if (uploadError) {
        console.error('Upload error details:', uploadError);
        pushLog(`❌ Storage upload failed: ${uploadError.message}`);
        throw uploadError;
      }
      pushLog(`✅ Storage upload OK (path=${uploadData?.path ?? fileName})`);

      const { data: { publicUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);
      pushLog(`Public URL: ${publicUrl}`);

      // Quick reachability check so APK builds can confirm CDN delivery
      try {
        const head = await fetch(publicUrl, { method: 'HEAD' });
        pushLog(`HEAD ${publicUrl.split('/').pop()} → ${head.status}`);
      } catch (e: any) {
        pushLog(`HEAD check failed: ${e?.message ?? e}`);
      }

      // Note: Since videos bucket is now private, we'll store the path
      // and generate signed URLs on-demand for viewing

      // Upload thumbnail if provided, otherwise generate from video
      let thumbnailUrl = '';
      if (thumbnailFile) {
        const thumbExt = thumbnailFile.name.split('.').pop();
        const thumbName = `${user.id}/thumb_${Date.now()}.${thumbExt}`;
        
        const { error: thumbError } = await supabase.storage
          .from('videos')
          .upload(thumbName, thumbnailFile);

        if (!thumbError) {
          const { data: { publicUrl: thumbUrl } } = supabase.storage
            .from('videos')
            .getPublicUrl(thumbName);
          thumbnailUrl = thumbUrl;
        }
      } else {
        // Auto-generate thumbnail from video
        try {
          const thumbnailBlob = await generateThumbnail(videoFile);
          const thumbName = `${user.id}/thumb_${Date.now()}.jpg`;
          
          const { error: thumbError } = await supabase.storage
            .from('videos')
            .upload(thumbName, thumbnailBlob);

          if (!thumbError) {
            const { data: { publicUrl: thumbUrl } } = supabase.storage
              .from('videos')
              .getPublicUrl(thumbName);
            thumbnailUrl = thumbUrl;
          }
        } catch (thumbError) {
          console.error('Thumbnail generation failed:', thumbError);
          // Continue without thumbnail
        }
      }

      // Store the URL path - signed URLs will be generated on-demand for viewing
      const { data: { publicUrl: videoUrl } } = supabase.storage
        .from('videos')
        .getPublicUrl(fileName);

      // Combine manually added hashtags with any extracted from title
      const extractedTags = extractHashtags(title);
      const allTags = [...new Set([...hashtags, ...extractedTags])].slice(0, 10);
      
      const { data: insertedVideo, error: insertError } = await supabase
        .from('videos')
        .insert({
          creator_id: user.id,
          title: title.trim(),
          description: description.trim() || null,
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          tags: allTags.length > 0 ? allTags : null,
          transcription_status: 'pending',
        })
        .select('id')
        .single();

      if (insertError) {
        pushLog(`❌ DB insert failed: ${insertError.message}`);
        throw insertError;
      }
      pushLog(`✅ DB row inserted: videos.id=${insertedVideo?.id}`);

      setUploadProgress(100);
      toast.success('Video uploaded successfully!');

      // Trigger transcription in background (don't wait for it)
      if (insertedVideo?.id) {
        triggerTranscription(insertedVideo.id, videoUrl);
      }

      setTimeout(() => navigate('/feed'), 500);
    } catch (error: any) {
      if (progressInterval) clearInterval(progressInterval);
      console.error('Upload error:', error);
      pushLog(`❌ Upload exception: ${error?.message ?? error}`);
      
      let errorMessage = 'Upload failed';
      if (error.message?.includes('Failed to fetch')) {
        errorMessage = 'Network error. Check your connection and try again.';
      } else if (error.message?.includes('payload')) {
        errorMessage = 'File too large. Maximum size is 250MB.';
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
      setUploadFailed(true);
    } finally {
      setLoading(false);
      setUploadProgress(0);
    }
  };

  const handleRetry = (e: React.MouseEvent) => {
    e.preventDefault();
    setUploadFailed(false);
    handleUpload(e as unknown as React.FormEvent);
  };

  if (roleChecking) {
    return (
      <ResponsiveLayout>
        <div className="min-h-screen flex items-center justify-center bg-background">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-primary/30 border-t-primary" />
        </div>
      </ResponsiveLayout>
    );
  }

  if (!isCreative) {
    return (
      <ResponsiveLayout>
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <Card className="max-w-md w-full shadow-elevated">
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Uploading is for Creatives</h2>
              <p className="text-sm text-muted-foreground">
                Your account is set up as a Viewer. Switch to a Creative account in Settings to upload Toonz.
              </p>
              <div className="flex gap-2 justify-center pt-2">
                <Button variant="outline" onClick={() => navigate('/feed')}>Back to Feed</Button>
                <Button onClick={() => navigate('/settings')}>Go to Settings</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
    <div className="min-h-screen bg-background pb-20 md:pb-4">
      <div className="max-w-2xl mx-auto p-4">
        <div className="mb-6 flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate('/feed')}
            className="rounded-full"
          >
            <ArrowLeft className="h-6 w-6" />
          </Button>
          <h1 className="text-2xl font-black">Upload Soccer Content</h1>
        </div>

        <Card className="shadow-elevated">
          <CardHeader>
            <CardTitle>Share Your Creative Work</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleUpload} className="space-y-6">
              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                  placeholder="Give your soccer content a catchy title"
                  maxLength={100}
                  required
                />
                <p className="text-xs text-muted-foreground text-right">{title.length}/100</p>
              </div>

              {/* Hashtags */}
              <div className="space-y-2">
                <Label htmlFor="hashtags" className="flex items-center gap-1.5">
                  <Hash className="h-4 w-4 text-blue-400" />
                  Hashtags
                </Label>
                <div className="flex gap-2">
                  <Input
                    id="hashtags"
                    value={hashtagInput}
                    onChange={(e) => setHashtagInput(e.target.value.replace(/\s/g, ''))}
                    onKeyDown={handleHashtagKeyDown}
                    onBlur={addHashtag}
                    placeholder="Type a hashtag and press Enter"
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addHashtag}
                    disabled={!hashtagInput.trim()}
                  >
                    Add
                  </Button>
                </div>
                {hashtags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {hashtags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-500/20 text-blue-400 rounded-full text-sm font-medium"
                      >
                        #{tag}
                        <button
                          type="button"
                          onClick={() => removeHashtag(tag)}
                          className="hover:text-blue-200 transition-colors"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">{hashtags.length}/10 hashtags</p>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value.slice(0, 500))}
                  placeholder="Add more details about your soccer content"
                  rows={3}
                />
                <p className="text-xs text-muted-foreground text-right">{description.length}/500</p>
              </div>

              {/* Watermark Option */}
              <div className="space-y-2">
                <div className="flex items-center justify-between p-4 rounded-xl border border-border bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <Stamp className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <Label htmlFor="watermark" className="text-sm font-medium cursor-pointer">
                        Add DiskieReels Watermark
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Protect your content with our watermark (Optional)
                      </p>
                    </div>
                  </div>
                  <Switch
                    id="watermark"
                    checked={applyWatermark}
                    onCheckedChange={setApplyWatermark}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="video">Video File</Label>
                <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary transition-colors">
                  <input
                    id="video"
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setVideoFile(file);
                      if (file) {
                        setVideoPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="video"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    {videoPreview ? (
                      <video src={videoPreview} className="h-40 rounded-lg" controls />
                    ) : (
                      <UploadIcon className="h-12 w-12 text-primary" />
                    )}
                    <div className="text-sm">
                      {videoFile ? (
                        <span className="text-foreground font-semibold">{videoFile.name}</span>
                      ) : (
                        <>
                          <span className="text-primary font-semibold">Click to upload</span>
                          <span className="text-muted-foreground"> or drag and drop</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      MP4, MOV, or AVI (max 100MB)
                    </p>
                  </label>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="thumbnail">Thumbnail (Optional)</Label>
                <div className="border-2 border-dashed border-border rounded-2xl p-8 text-center hover:border-primary transition-colors">
                  <input
                    id="thumbnail"
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setThumbnailFile(file);
                      if (file) {
                        setThumbnailPreview(URL.createObjectURL(file));
                      }
                    }}
                    className="hidden"
                  />
                  <label
                    htmlFor="thumbnail"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    {thumbnailPreview ? (
                      <img src={thumbnailPreview} className="h-32 rounded-lg" alt="Thumbnail preview" />
                    ) : (
                      <UploadIcon className="h-12 w-12 text-primary" />
                    )}
                    <div className="text-sm">
                      {thumbnailFile ? (
                        <span className="text-foreground font-semibold">{thumbnailFile.name}</span>
                      ) : (
                        <>
                          <span className="text-primary font-semibold">Click to upload thumbnail</span>
                        </>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      JPG, PNG (recommended 9:16 ratio)
                    </p>
                  </label>
                </div>
              </div>

              {loading && uploadProgress > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-foreground">Uploading...</span>
                    <span className="text-primary font-semibold">{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-primary transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadFailed && !loading && (
                <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-sm">
                  <span className="text-destructive font-medium">Upload failed. Your file is still selected — try again.</span>
                  <Button type="button" size="sm" variant="outline" onClick={handleRetry}>
                    <RotateCcw className="h-4 w-4 mr-1" /> Retry
                  </Button>
                </div>
              )}

              {debugLogs.length > 0 && (
                <div className="rounded-xl border border-border bg-muted/40 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowDebug((v) => !v)}
                    className="w-full flex items-center justify-between px-3 py-2 font-mono text-foreground"
                  >
                    <span>🛠 Upload debug log ({debugLogs.length})</span>
                    <span className="opacity-60">{showDebug ? 'hide' : 'show'}</span>
                  </button>
                  {showDebug && (
                    <div className="px-3 pb-3">
                      <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] leading-relaxed text-muted-foreground">
{debugLogs.join('\n')}
                      </pre>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="mt-2 h-7 text-xs"
                        onClick={() => {
                          navigator.clipboard?.writeText(debugLogs.join('\n'));
                          toast.success('Debug log copied');
                        }}
                      >
                        Copy log
                      </Button>
                    </div>
                  )}
                </div>
              )}

              <Button
                type="submit"
                className="w-full rounded-full"
                disabled={loading}
                size="lg"
              >
                {loading ? 'Uploading...' : uploadFailed ? 'Try Upload Again' : 'Upload Soccer Content'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

    </div>
    </ResponsiveLayout>
  );
};

export default Upload;
