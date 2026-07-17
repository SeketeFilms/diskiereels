import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Upload as UploadIcon,
  ArrowLeft,
  X,
  Hash,
  Stamp,
  RotateCcw,
  Lock,
  Image as ImageIcon,
  Film,
  Sun,
  Moon,
} from 'lucide-react';
import ResponsiveLayout from '@/components/ResponsiveLayout';
import { toast } from 'sonner';
import { useTheme } from '@/contexts/ThemeContext';

const CATEGORIES = [
  'Goals', 'Skills', 'Highlights', 'Tutorials', 'Goalkeeper',
  'Training', 'Challenges', 'Fan Zone', 'Funny', 'Stories',
];

const Upload = () => {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const isDark = theme === 'luminous-moss' || theme === 'tiffany';

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [title, setTitle] = useState('');
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [hashtagInput, setHashtagInput] = useState('');
  const [category, setCategory] = useState<string>('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [applyWatermark, setApplyWatermark] = useState(false);
  const [uploadFailed, setUploadFailed] = useState(false);
  const [roleChecking, setRoleChecking] = useState(true);
  const [isCreative, setIsCreative] = useState(false);

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
  const removeHashtag = (t: string) => setHashtags(hashtags.filter(x => x !== t));
  const handleHashtagKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ' || e.key === ',') {
      e.preventDefault();
      addHashtag();
    }
  };

  const generateThumbnail = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.muted = true;
      v.onloadedmetadata = () => { v.currentTime = 0.5; };
      v.onseeked = () => {
        const c = document.createElement('canvas');
        c.width = v.videoWidth; c.height = v.videoHeight;
        const ctx = c.getContext('2d');
        if (!ctx) return reject(new Error('canvas'));
        ctx.drawImage(v, 0, 0, c.width, c.height);
        c.toBlob(b => b ? resolve(b) : reject(new Error('blob')), 'image/jpeg', 0.8);
      };
      v.onerror = () => reject(new Error('load'));
      v.src = URL.createObjectURL(file);
    });

  const validatePortrait = (file: File): Promise<boolean> =>
    new Promise(resolve => {
      const v = document.createElement('video');
      v.preload = 'metadata';
      v.onloadedmetadata = () => {
        const ok = v.videoWidth / v.videoHeight < 1;
        URL.revokeObjectURL(v.src); resolve(ok);
      };
      v.onerror = () => { URL.revokeObjectURL(v.src); resolve(false); };
      v.src = URL.createObjectURL(file);
    });

  const extractHashtags = (text: string): string[] => {
    const m = text.match(/#(\w+)/g);
    return m ? m.map(t => t.replace('#', '').toLowerCase()) : [];
  };

  const triggerTranscription = async (videoId: string, videoUrl: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-video`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ videoId, videoUrl }),
      });
    } catch { /* silent */ }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) { toast.error('Please enter a title'); return; }
    if (!videoFile) { toast.error('Please attach a video file to publish'); return; }

    const fileExt = videoFile.name.split('.').pop()?.toLowerCase();
    if (!fileExt || !['mp4', 'webm', 'mov'].includes(fileExt)) {
      toast.error('Only MP4, WebM, and MOV are supported.');
      return;
    }

    toast.info('Validating video...');
    if (!(await validatePortrait(videoFile))) {
      toast.error('Only portrait videos are allowed.');
      return;
    }

    setLoading(true); setUploadProgress(0); setUploadFailed(false);
    let progressInterval: ReturnType<typeof setInterval> | null = null;

    try {
      const estimated = Math.min((videoFile.size / 1024 / 1024) * 1000, 60000);
      progressInterval = setInterval(() => {
        setUploadProgress(p => (p >= 90 ? p : p + 5));
      }, estimated / 18);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');
      await supabase.rpc('ensure_current_user_profile');

      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage
        .from('videos').upload(fileName, videoFile, { cacheControl: '3600', upsert: false });

      if (progressInterval) clearInterval(progressInterval);
      setUploadProgress(95);
      if (uploadError) throw uploadError;

      const { data: { publicUrl: videoUrl } } = supabase.storage.from('videos').getPublicUrl(fileName);

      let thumbnailUrl = '';
      if (thumbnailFile) {
        const thumbExt = thumbnailFile.name.split('.').pop();
        const thumbName = `${user.id}/thumb_${Date.now()}.${thumbExt}`;
        const { error: te } = await supabase.storage.from('videos').upload(thumbName, thumbnailFile);
        if (!te) thumbnailUrl = supabase.storage.from('videos').getPublicUrl(thumbName).data.publicUrl;
      } else {
        try {
          const blob = await generateThumbnail(videoFile);
          const thumbName = `${user.id}/thumb_${Date.now()}.jpg`;
          const { error: te } = await supabase.storage.from('videos').upload(thumbName, blob);
          if (!te) thumbnailUrl = supabase.storage.from('videos').getPublicUrl(thumbName).data.publicUrl;
        } catch { /* keep empty */ }
      }

      const extracted = extractHashtags(title);
      const catTag = category ? [category.toLowerCase().replace(/[^a-z0-9]+/g, '')] : [];
      const allTags = [...new Set([...catTag, ...hashtags, ...extracted])].slice(0, 10);

      const { data: inserted, error: insertError } = await supabase
        .from('videos')
        .insert({
          creator_id: user.id,
          title: title.trim(),
          video_url: videoUrl,
          thumbnail_url: thumbnailUrl,
          tags: allTags.length > 0 ? allTags : null,
          transcription_status: 'pending',
        })
        .select('id')
        .single();

      if (insertError) throw insertError;
      setUploadProgress(100);
      toast.success('Reel published!');
      if (inserted?.id) triggerTranscription(inserted.id, videoUrl);
      setTimeout(() => navigate('/feed'), 500);
    } catch (err: any) {
      if (progressInterval) clearInterval(progressInterval);
      const msg = err?.message?.includes('Failed to fetch')
        ? 'Network error. Check your connection and try again.'
        : err?.message || 'Upload failed';
      toast.error(msg);
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

  const toggleTheme = () => setTheme(isDark ? 'diskie-green' : 'luminous-moss');

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
          <Card className="max-w-md w-full">
            <CardContent className="pt-8 pb-6 text-center space-y-4">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                <Lock className="h-7 w-7 text-primary" />
              </div>
              <h2 className="text-xl font-bold">Uploading is for Creatives</h2>
              <p className="text-sm text-muted-foreground">
                Switch to a Creative account in Settings to upload reels.
              </p>
              <div className="flex gap-2 justify-center pt-2">
                <Button variant="outline" onClick={() => navigate('/feed')}>Back</Button>
                <Button onClick={() => navigate('/settings')}>Settings</Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </ResponsiveLayout>
    );
  }

  return (
    <ResponsiveLayout>
      <div className="min-h-screen bg-background pb-28 md:pb-6">
        <div className="max-w-xl mx-auto px-4 pt-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate('/feed')}
                className="rounded-full h-9 w-9"
                aria-label="Back"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-lg font-bold">New Reel</h1>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={toggleTheme}
              className="rounded-full h-9 w-9 border-primary/40"
              aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
          </div>

          <form onSubmit={handleUpload} className="space-y-5">
            {/* Title — required */}
            <div className="space-y-1.5">
              <Label htmlFor="title" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Title <span className="text-primary">*</span>
              </Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value.slice(0, 100))}
                placeholder="Give your reel a catchy title"
                maxLength={100}
                required
                className="h-11 rounded-xl bg-card border-border"
              />
              <p className="text-[10px] text-muted-foreground text-right">{title.length}/100</p>
            </div>

            {/* Hashtags — compact chips */}
            <div className="space-y-1.5">
              <Label htmlFor="hashtags" className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                <Hash className="h-3 w-3" /> Hashtags
              </Label>
              <div className="rounded-xl border border-border bg-card px-2.5 py-2 flex flex-wrap gap-1.5 items-center min-h-[44px]">
                {hashtags.map(tag => (
                  <span
                    key={tag}
                    className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-primary/15 text-primary rounded-full text-xs font-medium"
                  >
                    #{tag}
                    <button
                      type="button"
                      onClick={() => removeHashtag(tag)}
                      className="hover:bg-primary/20 rounded-full p-0.5"
                      aria-label={`Remove ${tag}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
                <input
                  id="hashtags"
                  value={hashtagInput}
                  onChange={(e) => setHashtagInput(e.target.value.replace(/\s/g, ''))}
                  onKeyDown={handleHashtagKeyDown}
                  onBlur={addHashtag}
                  placeholder={hashtags.length === 0 ? 'Type & press Enter' : ''}
                  className="flex-1 min-w-[100px] bg-transparent outline-none text-xs placeholder:text-muted-foreground"
                />
              </div>
              <p className="text-[10px] text-muted-foreground">{hashtags.length}/10</p>
            </div>

            {/* Category — compact horizontal scroll pills */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Category
              </Label>
              <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-4 px-4 pb-1">
                {CATEGORIES.map(cat => {
                  const active = category === cat;
                  return (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategory(active ? '' : cat)}
                      className={`shrink-0 px-3 py-1.5 rounded-full border text-xs font-semibold transition-colors ${
                        active
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card border-border text-foreground hover:border-primary/60'
                      }`}
                    >
                      {cat}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Video + Thumbnail — compact dashed drop zones */}
            <div className="grid grid-cols-2 gap-3">
              {/* Video */}
              <div>
                <input
                  id="video"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setVideoFile(f);
                    if (f) setVideoPreview(URL.createObjectURL(f));
                  }}
                />
                <label
                  htmlFor="video"
                  className="cursor-pointer flex flex-col items-center justify-center gap-1.5 aspect-[3/4] rounded-2xl border-2 border-dashed border-border hover:border-primary transition-colors bg-card/40 relative overflow-hidden"
                >
                  {videoPreview ? (
                    <video src={videoPreview} className="absolute inset-0 w-full h-full object-cover" muted />
                  ) : (
                    <>
                      <div className="p-2.5 rounded-xl bg-primary/10">
                        <Film className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">Video file</span>
                      <span className="text-[10px] text-muted-foreground">Optional · MP4/MOV</span>
                    </>
                  )}
                  {videoFile && (
                    <span className="absolute bottom-1 left-1 right-1 text-[10px] font-semibold text-white bg-black/60 px-1.5 py-0.5 rounded truncate">
                      {videoFile.name}
                    </span>
                  )}
                </label>
              </div>

              {/* Thumbnail */}
              <div>
                <input
                  id="thumb"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0] || null;
                    setThumbnailFile(f);
                    if (f) setThumbnailPreview(URL.createObjectURL(f));
                  }}
                />
                <label
                  htmlFor="thumb"
                  className="cursor-pointer flex flex-col items-center justify-center gap-1.5 aspect-[3/4] rounded-2xl border-2 border-dashed border-border hover:border-primary transition-colors bg-card/40 relative overflow-hidden"
                >
                  {thumbnailPreview ? (
                    <img src={thumbnailPreview} alt="Thumbnail" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <>
                      <div className="p-2.5 rounded-xl bg-primary/10">
                        <ImageIcon className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-xs font-semibold text-foreground">Thumbnail</span>
                      <span className="text-[10px] text-muted-foreground">Optional · JPG/PNG</span>
                    </>
                  )}
                </label>
              </div>
            </div>

            {/* Watermark toggle */}
            <div className="flex items-center justify-between p-3 rounded-2xl border border-border bg-card/40">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-lg bg-primary/10">
                  <Stamp className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <Label htmlFor="watermark" className="text-xs font-semibold cursor-pointer">
                    Watermark
                  </Label>
                  <p className="text-[10px] text-muted-foreground">Optional · adds DiskieReels stamp</p>
                </div>
              </div>
              <Switch id="watermark" checked={applyWatermark} onCheckedChange={setApplyWatermark} />
            </div>

            {/* Progress */}
            {loading && uploadProgress > 0 && (
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span>Uploading…</span>
                  <span className="text-primary font-semibold">{uploadProgress}%</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                </div>
              </div>
            )}

            {/* Retry */}
            {uploadFailed && !loading && (
              <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-destructive/40 bg-destructive/10 text-xs">
                <span className="text-destructive font-medium">Upload failed. Try again.</span>
                <Button type="button" size="sm" variant="outline" onClick={handleRetry}>
                  <RotateCcw className="h-3.5 w-3.5 mr-1" /> Retry
                </Button>
              </div>
            )}

            {/* Publish */}
            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-full text-sm font-bold"
              size="lg"
            >
              <UploadIcon className="h-4 w-4 mr-2" />
              {loading ? 'Publishing…' : uploadFailed ? 'Try Again' : 'Publish Reel'}
            </Button>
          </form>
        </div>
      </div>
    </ResponsiveLayout>
  );
};

export default Upload;
