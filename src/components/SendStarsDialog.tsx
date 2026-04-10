import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Star, Sparkles } from 'lucide-react';
import StarGiftAnimation from './StarGiftAnimation';

interface SendStarsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  creatorId: string;
  creatorUsername: string;
  videoId: string;
  currentUserId: string;
}

const STAR_AMOUNTS = [1, 5, 10, 50, 100, 500];

const SendStarsDialog = ({ open, onOpenChange, creatorId, creatorUsername, videoId, currentUserId }: SendStarsDialogProps) => {
  const [balance, setBalance] = useState(0);
  const [selectedAmount, setSelectedAmount] = useState(5);
  const [sending, setSending] = useState(false);
  const [showBuySection, setShowBuySection] = useState(false);
  const [showGiftAnimation, setShowGiftAnimation] = useState(false);
  const [giftAnimationAmount, setGiftAnimationAmount] = useState(0);
  const [starPacks, setStarPacks] = useState<Array<{ id: string; name: string; stars_amount: number; price_cents: number }>>([]);

  useEffect(() => {
    if (open) {
      fetchBalance();
      fetchPacks();
    }
  }, [open]);

  const fetchBalance = async () => {
    const { data } = await supabase
      .from('star_balances')
      .select('balance')
      .eq('user_id', currentUserId)
      .maybeSingle();
    setBalance(data?.balance || 0);
  };

  const fetchPacks = async () => {
    const { data } = await supabase
      .from('star_packs')
      .select('*')
      .eq('is_active', true)
      .order('stars_amount');
    setStarPacks((data as any[]) || []);
  };

  const handleBuyStars = async (packId: string, amount: number) => {
    // Mock purchase - in production this would go through Stripe
    try {
      // Upsert balance
      const { data: existing } = await supabase
        .from('star_balances')
        .select('*')
        .eq('user_id', currentUserId)
        .maybeSingle();

      if (existing) {
        await supabase
          .from('star_balances')
          .update({ 
            balance: (existing as any).balance + amount,
            total_spent: (existing as any).total_spent + amount,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', currentUserId);
      } else {
        await supabase
          .from('star_balances')
          .insert({ user_id: currentUserId, balance: amount, total_spent: 0, total_earned: 0 });
      }

      // Record transaction
      await supabase.from('star_transactions').insert({
        from_user_id: currentUserId,
        to_user_id: currentUserId,
        amount,
        type: 'purchase'
      });

      setBalance(prev => prev + amount);
      setShowBuySection(false);
      toast.success(`Purchased ${amount} ⭐ stars!`);
    } catch {
      toast.error('Failed to purchase stars');
    }
  };

  const handleSendStars = async () => {
    if (selectedAmount > balance) {
      setShowBuySection(true);
      return;
    }

    setSending(true);
    try {
      // Deduct from sender
      await supabase
        .from('star_balances')
        .update({ 
          balance: balance - selectedAmount,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', currentUserId);

      // Add to creator (upsert)
      const { data: creatorBalance } = await supabase
        .from('star_balances')
        .select('*')
        .eq('user_id', creatorId)
        .maybeSingle();

      if (creatorBalance) {
        await supabase
          .from('star_balances')
          .update({
            balance: (creatorBalance as any).balance + selectedAmount,
            total_earned: (creatorBalance as any).total_earned + selectedAmount,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', creatorId);
      } else {
        await supabase
          .from('star_balances')
          .insert({ user_id: creatorId, balance: selectedAmount, total_earned: selectedAmount, total_spent: 0 });
      }

      // Update creator monetization
      const { data: monet } = await supabase
        .from('creator_monetization')
        .select('*')
        .eq('user_id', creatorId)
        .maybeSingle();

      if (monet) {
        await supabase
          .from('creator_monetization')
          .update({
            total_stars_earned: (monet as any).total_stars_earned + selectedAmount,
            pending_balance: (monet as any).pending_balance + selectedAmount,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', creatorId);
      } else {
        await supabase
          .from('creator_monetization')
          .insert({ user_id: creatorId, total_stars_earned: selectedAmount, pending_balance: selectedAmount });
      }

      // Record gift transaction
      await supabase.from('star_transactions').insert({
        from_user_id: currentUserId,
        to_user_id: creatorId,
        video_id: videoId,
        amount: selectedAmount,
        type: 'gift'
      });

      setBalance(prev => prev - selectedAmount);
      setGiftAnimationAmount(selectedAmount);
      setShowGiftAnimation(true);
      onOpenChange(false);
    } catch {
      toast.error('Failed to send stars');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {showGiftAnimation && (
        <StarGiftAnimation
          amount={giftAnimationAmount}
          onComplete={() => {
            setShowGiftAnimation(false);
            toast.success(`Sent ${giftAnimationAmount} ⭐ to @${creatorUsername}!`);
          }}
        />
      )}
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-sm mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Send Stars to @{creatorUsername}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Balance */}
            <div className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
              <span className="text-sm text-muted-foreground">Your Stars</span>
              <span className="font-bold text-lg flex items-center gap-1">
                <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                {balance}
              </span>
            </div>

            {!showBuySection ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {STAR_AMOUNTS.map(amount => (
                    <button
                      key={amount}
                      onClick={() => setSelectedAmount(amount)}
                      className={`p-2 rounded-lg border text-center transition-all ${
                        selectedAmount === amount
                          ? 'border-primary bg-primary/10 text-primary font-bold'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <Star className="h-4 w-4 text-yellow-500 fill-yellow-500 mx-auto mb-0.5" />
                      <span className="text-sm font-medium">{amount}</span>
                    </button>
                  ))}
                </div>

                <Button onClick={handleSendStars} disabled={sending} className="w-full">
                  {sending ? 'Sending...' : `Send ${selectedAmount} ⭐ Stars`}
                </Button>

                <button onClick={() => setShowBuySection(true)} className="w-full text-xs text-primary hover:underline">
                  Need more stars? Buy here
                </button>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">Buy Star Packs</p>
                <div className="space-y-2">
                  {starPacks.map(pack => (
                    <button
                      key={pack.id}
                      onClick={() => handleBuyStars(pack.id, pack.stars_amount)}
                      className="w-full flex items-center justify-between p-3 rounded-lg border border-border hover:border-primary/50 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                        <div className="text-left">
                          <p className="text-sm font-medium">{pack.name}</p>
                          <p className="text-xs text-muted-foreground">{pack.stars_amount} stars</p>
                        </div>
                      </div>
                      <span className="text-sm font-bold text-primary">
                        ${(pack.price_cents / 100).toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
                <Button variant="outline" onClick={() => setShowBuySection(false)} className="w-full">
                  Back
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SendStarsDialog;
