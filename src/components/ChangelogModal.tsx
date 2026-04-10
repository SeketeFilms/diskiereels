import { Sparkles, Gift } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ChangelogEntry } from '@/hooks/useChangelog';

interface ChangelogModalProps {
  open: boolean;
  onClose: () => void;
  isNewVersion: boolean;
  currentVersion: string;
  changelog: ChangelogEntry[];
}

const ChangelogModal = ({ open, onClose, isNewVersion, currentVersion, changelog }: ChangelogModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md max-h-[80vh]">
        <DialogHeader>
          <div className="flex items-center gap-2">
            {isNewVersion ? (
              <Gift className="h-6 w-6 text-primary animate-bounce" />
            ) : (
              <Sparkles className="h-6 w-6 text-primary" />
            )}
            <DialogTitle className="text-xl">
              {isNewVersion ? "What's New!" : "Changelog"}
            </DialogTitle>
          </div>
          <DialogDescription>
            {isNewVersion 
              ? `ToonlyReels has been updated to version ${currentVersion}!`
              : `Current version: ${currentVersion}`
            }
          </DialogDescription>
        </DialogHeader>
        
        <ScrollArea className="max-h-[50vh] pr-4">
          <div className="space-y-6">
            {changelog.map((entry, index) => (
              <div 
                key={entry.version} 
                className={`${index === 0 && isNewVersion ? 'bg-primary/5 -mx-2 px-2 py-3 rounded-lg border border-primary/20' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-sm">
                    Version {entry.version}
                    {index === 0 && <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Latest</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{entry.date}</span>
                </div>
                <ul className="space-y-1.5">
                  {entry.changes.map((change, i) => (
                    <li key={i} className="text-sm text-muted-foreground leading-relaxed">
                      {change}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ScrollArea>
        
        <Button onClick={onClose} className="w-full mt-4">
          {isNewVersion ? "Got it, thanks!" : "Close"}
        </Button>
      </DialogContent>
    </Dialog>
  );
};

export default ChangelogModal;
