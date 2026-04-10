import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { GripVertical, Save, X } from 'lucide-react';

// Custom social icons
const TikTokIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const YouTubeIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
  </svg>
);

interface SocialLinksEditorProps {
  userId: string;
  tiktokUrl?: string | null;
  instagramUrl?: string | null;
  facebookUrl?: string | null;
  youtubeUrl?: string | null;
  linksOrder?: string[];
  linksVisible?: string[];
  onSave?: () => void;
  onClose?: () => void;
}

export default function SocialLinksEditor({
  userId,
  tiktokUrl: initialTiktok = '',
  instagramUrl: initialInstagram = '',
  facebookUrl: initialFacebook = '',
  youtubeUrl: initialYoutube = '',
  linksOrder: initialOrder = ['tiktok', 'instagram', 'facebook', 'youtube'],
  linksVisible: initialVisible = ['tiktok', 'instagram', 'facebook', 'youtube'],
  onSave,
  onClose
}: SocialLinksEditorProps) {
  const [tiktok, setTiktok] = useState(initialTiktok || '');
  const [instagram, setInstagram] = useState(initialInstagram || '');
  const [facebook, setFacebook] = useState(initialFacebook || '');
  const [youtube, setYoutube] = useState(initialYoutube || '');
  const [order, setOrder] = useState<string[]>(initialOrder);
  const [visible, setVisible] = useState<string[]>(initialVisible);
  const [isSaving, setIsSaving] = useState(false);
  const [draggedItem, setDraggedItem] = useState<string | null>(null);

  const platforms = [
    { id: 'tiktok', label: 'TikTok', icon: TikTokIcon, value: tiktok, setValue: setTiktok, placeholder: 'https://tiktok.com/@username' },
    { id: 'instagram', label: 'Instagram', icon: InstagramIcon, value: instagram, setValue: setInstagram, placeholder: 'https://instagram.com/username' },
    { id: 'facebook', label: 'Facebook', icon: FacebookIcon, value: facebook, setValue: setFacebook, placeholder: 'https://facebook.com/page' },
    { id: 'youtube', label: 'YouTube', icon: YouTubeIcon, value: youtube, setValue: setYoutube, placeholder: 'https://youtube.com/@channel' },
  ];

  // Sort platforms by order
  const sortedPlatforms = [...platforms].sort((a, b) => {
    const aIndex = order.indexOf(a.id);
    const bIndex = order.indexOf(b.id);
    return aIndex - bIndex;
  });

  const toggleVisibility = (platformId: string) => {
    if (visible.includes(platformId)) {
      setVisible(visible.filter(id => id !== platformId));
    } else {
      setVisible([...visible, platformId]);
    }
  };

  const handleDragStart = (platformId: string) => {
    setDraggedItem(platformId);
  };

  const handleDragOver = (e: React.DragEvent, platformId: string) => {
    e.preventDefault();
    if (!draggedItem || draggedItem === platformId) return;

    const newOrder = [...order];
    const draggedIndex = newOrder.indexOf(draggedItem);
    const targetIndex = newOrder.indexOf(platformId);

    newOrder.splice(draggedIndex, 1);
    newOrder.splice(targetIndex, 0, draggedItem);
    setOrder(newOrder);
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
  };

  const validateUrl = (url: string, platform: string): boolean => {
    if (!url) return true;
    try {
      const urlObj = new URL(url);
      // Basic validation - just ensure it's a valid URL
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const handleSave = async () => {
    // Validate URLs
    if (tiktok && !validateUrl(tiktok, 'tiktok')) {
      toast.error('Please enter a valid TikTok URL');
      return;
    }
    if (instagram && !validateUrl(instagram, 'instagram')) {
      toast.error('Please enter a valid Instagram URL');
      return;
    }
    if (facebook && !validateUrl(facebook, 'facebook')) {
      toast.error('Please enter a valid Facebook URL');
      return;
    }
    if (youtube && !validateUrl(youtube, 'youtube')) {
      toast.error('Please enter a valid YouTube URL');
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          tiktok_url: tiktok || null,
          instagram_url: instagram || null,
          facebook_url: facebook || null,
          youtube_url: youtube || null,
          social_links_order: order,
          social_links_visible: visible
        })
        .eq('id', userId);

      if (error) throw error;

      toast.success('Social links updated!');
      onSave?.();
    } catch (error) {
      console.error('Error saving social links:', error);
      toast.error('Failed to save social links');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Social Links</h3>
        {onClose && (
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        Add your social media links. Drag to reorder, toggle to show/hide.
      </p>

      <div className="space-y-4">
        {sortedPlatforms.map((platform) => {
          const Icon = platform.icon;
          const isVisible = visible.includes(platform.id);
          const isDragging = draggedItem === platform.id;

          return (
            <div
              key={platform.id}
              draggable
              onDragStart={() => handleDragStart(platform.id)}
              onDragOver={(e) => handleDragOver(e, platform.id)}
              onDragEnd={handleDragEnd}
              className={`p-3 rounded-lg border bg-card transition-all ${
                isDragging ? 'opacity-50 border-primary' : 'border-border'
              }`}
            >
              <div className="flex items-center gap-3 mb-2">
                <div className="cursor-grab active:cursor-grabbing text-muted-foreground">
                  <GripVertical className="h-4 w-4" />
                </div>
                <Icon className="h-5 w-5" />
                <Label className="flex-1 font-medium">{platform.label}</Label>
                <Switch
                  checked={isVisible}
                  onCheckedChange={() => toggleVisibility(platform.id)}
                />
              </div>
              <Input
                type="url"
                value={platform.value}
                onChange={(e) => platform.setValue(e.target.value)}
                placeholder={platform.placeholder}
                className="mt-2"
              />
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 pt-4">
        <Button onClick={handleSave} disabled={isSaving} className="flex-1">
          <Save className="h-4 w-4 mr-2" />
          {isSaving ? 'Saving...' : 'Save Links'}
        </Button>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
