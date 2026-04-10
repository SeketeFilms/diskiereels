import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BookOpen, Clock, Lock, Moon } from 'lucide-react';
import { toast } from 'sonner';

interface ScreenTimeLockProps {
  userId: string;
  lockReason: 'screen_time' | 'bedtime' | 'school_hours' | null;
  timeUsed: number;
  timeLimit: number;
  onUnlock: () => void;
}

export default function ScreenTimeLock({
  userId,
  lockReason,
  timeUsed,
  timeLimit,
  onUnlock,
}: ScreenTimeLockProps) {
  const [pin, setPin] = useState('');
  const [showPinInput, setShowPinInput] = useState(false);

  const handleParentUnlock = async () => {
    try {
      const { data: isValid } = await supabase.rpc('verify_parental_pin', {
        _user_id: userId,
        _raw_pin: pin,
      });

      if (isValid) {
        const today = new Date().toDateString();
        const usageKey = `screen_time_${userId}_${today}`;
        const currentUsage = parseInt(localStorage.getItem(usageKey) || '0', 10);
        localStorage.setItem(usageKey, Math.max(0, currentUsage - 15).toString());
        onUnlock();
        toast.success('Unlocked: +15 minutes');
      } else {
        toast.error('Invalid PIN');
      }
    } catch {
      toast.error('Failed to verify PIN');
    } finally {
      setPin('');
      setShowPinInput(false);
    }
  };

  if (!lockReason) return null;

  const content =
    lockReason === 'screen_time'
      ? {
          icon: <Clock className="h-16 w-16 text-fun-coral" />,
          title: "Time's Up",
          message: `You've used your ${timeLimit} minutes today.`,
          subMessage: 'Come back tomorrow.',
          gradient: 'from-fun-coral/20 to-fun-coral/5',
        }
      : lockReason === 'bedtime'
        ? {
            icon: <Moon className="h-16 w-16 text-fun-blue" />,
            title: 'Bedtime',
            message: 'Time to rest and recharge.',
            subMessage: 'See you tomorrow.',
            gradient: 'from-fun-blue/20 to-fun-blue/5',
          }
        : {
            icon: <BookOpen className="h-16 w-16 text-fun-green" />,
            title: 'School Time',
            message: "It's time for learning.",
            subMessage: 'Come back after school.',
            gradient: 'from-fun-green/20 to-fun-green/5',
          };

  return (
    <div
      className={`fixed inset-0 z-[100] bg-gradient-to-b ${content.gradient} backdrop-blur-xl flex flex-col items-center justify-center p-6`}
    >
      <div className="text-center space-y-6 max-w-sm">
        <div className="animate-bounce">{content.icon}</div>

        <div className="space-y-2">
          <h1 className="text-3xl font-black text-foreground">{content.title}</h1>
          <p className="text-lg text-muted-foreground">{content.message}</p>
          <p className="text-sm text-muted-foreground/70">{content.subMessage}</p>
        </div>

        {lockReason === 'screen_time' && (
          <div className="bg-card rounded-xl p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Today's Usage</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-2xl font-black">{timeUsed}</span>
              <span className="text-muted-foreground">/ {timeLimit} min</span>
            </div>
          </div>
        )}

        {!showPinInput ? (
          <Button variant="outline" onClick={() => setShowPinInput(true)} className="mt-8">
            <Lock className="h-4 w-4 mr-2" />
            Parent Unlock
          </Button>
        ) : (
          <div className="space-y-3 mt-8">
            <Input
              type="password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="Enter parent PIN"
              className="text-center text-xl tracking-widest"
            />
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setShowPinInput(false)} className="flex-1">
                Cancel
              </Button>
              <Button onClick={handleParentUnlock} disabled={pin.length < 4} className="flex-1">
                Unlock
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
