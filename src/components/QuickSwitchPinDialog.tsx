import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, Eye, EyeOff } from 'lucide-react';

interface SavedAccount {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  selected_avatar: string | null;
  loginSaved?: boolean;
  pinHash?: string;
}

interface QuickSwitchPinDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: SavedAccount | null;
  onSuccess: (email: string) => void;
  onUsePassword: () => void;
}

const QuickSwitchPinDialog = ({
  open,
  onOpenChange,
  account,
  onSuccess,
  onUsePassword,
}: QuickSwitchPinDialogProps) => {
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState('');

  const handleVerify = () => {
    if (!account) return;

    // Verify PIN (simple hash check)
    const expectedHash = btoa(pin + account.id.slice(0, 8));
    
    if (expectedHash === account.pinHash) {
      setPin('');
      setError('');
      onSuccess(account.email);
    } else {
      setError('Incorrect PIN');
      setPin('');
    }
  };

  const handleClose = () => {
    setPin('');
    setError('');
    onOpenChange(false);
  };

  if (!account) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-2xl overflow-hidden border-2 border-border">
              {account.avatar_url ? (
                <img src={account.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : account.selected_avatar ? (
                account.selected_avatar
              ) : (
                <User className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
          </div>
          <DialogTitle className="text-center">{account.username}</DialogTitle>
          <DialogDescription className="text-center">
            Enter your PIN to switch to this account
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="switchPin">PIN</Label>
            <div className="relative">
              <Input
                id="switchPin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                  setError('');
                }}
                placeholder="Enter 4-digit PIN"
                maxLength={4}
                inputMode="numeric"
                className={`pr-10 ${error ? 'border-destructive' : ''}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && pin.length === 4) {
                    handleVerify();
                  }
                }}
                autoFocus
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={handleVerify} disabled={pin.length !== 4}>
              Switch Account
            </Button>
            <Button variant="ghost" onClick={onUsePassword}>
              Use Password Instead
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default QuickSwitchPinDialog;
