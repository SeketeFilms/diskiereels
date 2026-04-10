import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface DownloadProgressOverlayProps {
  progress: number;
  stage: string;
  onCancel: () => void;
}

const DownloadProgressOverlay = ({
  progress,
  stage,
  onCancel,
}: DownloadProgressOverlayProps) => {
  return (
    <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-lg border border-border">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-lg text-card-foreground">Downloading Reel</h3>
          <Button
            size="icon"
            variant="ghost"
            onClick={onCancel}
            className="h-8 w-8 rounded-full hover:bg-destructive/10 hover:text-destructive"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{stage}</p>
          <Progress value={progress} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{progress}%</span>
            <span>{progress === 100 ? 'Complete!' : 'Processing...'}</span>
          </div>
        </div>
        
        <Button
          variant="outline"
          onClick={onCancel}
          className="w-full mt-4"
        >
          <X className="h-4 w-4 mr-2" />
          Cancel Download
        </Button>
      </div>
    </div>
  );
};

export default DownloadProgressOverlay;
