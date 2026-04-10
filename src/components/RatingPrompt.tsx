import { Star } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

interface RatingPromptProps {
  open: boolean;
  onRateNow: () => void;
  onRemindLater: () => void;
  onNoThanks: () => void;
}

const RatingPrompt = ({ open, onRateNow, onRemindLater, onNoThanks }: RatingPromptProps) => {
  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-sm" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-3">
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className="h-8 w-8 text-yellow-400 fill-yellow-400 animate-pulse"
                  style={{ animationDelay: `${star * 100}ms` }}
                />
              ))}
            </div>
          </div>
          <DialogTitle className="text-xl">Enjoying ToonlyReels?</DialogTitle>
          <DialogDescription className="text-center">
            We'd love to hear from you! Your review helps other kids and parents discover safe, fun cartoon content.
          </DialogDescription>
        </DialogHeader>
        
        <div className="flex flex-col gap-2 mt-4">
          <Button onClick={onRateNow} className="w-full">
            <Star className="h-4 w-4 mr-2" />
            Rate on Play Store
          </Button>
          <Button variant="outline" onClick={onRemindLater} className="w-full">
            Remind Me Later
          </Button>
          <Button variant="ghost" onClick={onNoThanks} className="w-full text-muted-foreground">
            No Thanks
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default RatingPrompt;
