import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, Smartphone, Monitor, Wifi, Zap, Crown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DownloadQualityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectQuality: (quality: string, skipWatermark: boolean) => void;
  videoTitle: string;
  isPremium: boolean;
}

const qualityOptions = [
  {
    value: 'original',
    label: 'Original Quality',
    description: 'Best quality, largest file size',
    icon: Monitor,
    size: '~50-100 MB',
    recommended: true,
  },
  {
    value: '1080p',
    label: '1080p (Full HD)',
    description: 'High quality for most devices',
    icon: Monitor,
    size: '~30-60 MB',
    recommended: false,
  },
  {
    value: '720p',
    label: '720p (HD)',
    description: 'Good quality, balanced size',
    icon: Smartphone,
    size: '~15-30 MB',
    recommended: false,
  },
  {
    value: '480p',
    label: '480p (SD)',
    description: 'Faster download, smaller size',
    icon: Wifi,
    size: '~8-15 MB',
    recommended: false,
  },
];

const DownloadQualityDialog = ({
  open,
  onOpenChange,
  onSelectQuality,
  videoTitle,
  isPremium,
}: DownloadQualityDialogProps) => {
  const [selectedQuality, setSelectedQuality] = useState('original');
  const [skipWatermark, setSkipWatermark] = useState(false);

  const handleDownload = () => {
    onSelectQuality(selectedQuality, skipWatermark);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="h-5 w-5 text-primary" />
            Choose Quality
          </DialogTitle>
          <DialogDescription>
            Select video quality for "{videoTitle}"
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-4">
          {qualityOptions.map((option) => {
            const Icon = option.icon;
            return (
              <button
                key={option.value}
                onClick={() => setSelectedQuality(option.value)}
                className={cn(
                  'w-full flex items-start gap-3 p-4 rounded-lg border-2 transition-all hover:border-primary/50',
                  selectedQuality === option.value
                    ? 'border-primary bg-primary/5'
                    : 'border-border bg-background'
                )}
              >
                <div className={cn(
                  'rounded-full p-2 mt-0.5',
                  selectedQuality === option.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm">{option.label}</span>
                    {option.recommended && (
                      <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-medium">
                        Recommended
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {option.description}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">
                    Est. size: {option.size}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Premium: Skip Watermark Option */}
        <div className="border-t pt-4">
          <button
            onClick={() => isPremium && setSkipWatermark(!skipWatermark)}
            disabled={!isPremium}
            className={cn(
              'w-full flex items-center gap-3 p-4 rounded-lg border-2 transition-all',
              !isPremium && 'opacity-60 cursor-not-allowed',
              isPremium && skipWatermark
                ? 'border-fun-yellow bg-fun-yellow/10'
                : 'border-border bg-background hover:border-fun-yellow/50'
            )}
          >
            <div className={cn(
              'rounded-full p-2',
              isPremium && skipWatermark
                ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-white'
                : 'bg-muted text-muted-foreground'
            )}>
              {isPremium ? <Zap className="h-4 w-4" /> : <Crown className="h-4 w-4" />}
            </div>
            <div className="flex-1 text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">
                  {isPremium ? 'Download without watermark' : 'No watermark (Premium)'}
                </span>
                {isPremium && skipWatermark && (
                  <span className="text-xs bg-fun-yellow/20 text-fun-yellow px-2 py-0.5 rounded-full font-medium">
                    Selected
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isPremium 
                  ? 'Download faster without ToonlyReels watermark' 
                  : 'Upgrade to Premium for watermark-free downloads'}
              </p>
            </div>
          </button>
        </div>

        <div className="flex gap-2 justify-end mt-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleDownload}>
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default DownloadQualityDialog;
