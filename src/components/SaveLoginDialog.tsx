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
import { Shield, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

interface SaveLoginDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  email: string;
  username: string;
  avatarUrl: string | null;
  selectedAvatar: string | null;
  onComplete: () => void;
}

const SaveLoginDialog = ({
  open,
  onOpenChange,
  userId,
  email,
  username,
  avatarUrl,
  selectedAvatar,
  onComplete,
}: SaveLoginDialogProps) => {
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSaveLogin = async () => {
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      toast.error('PIN must be exactly 4 digits');
      return;
    }

    if (pin !== confirmPin) {
      toast.error('PINs do not match');
      return;
    }

    setSaving(true);

    try {
      // Get existing saved accounts
      const existingAccounts = JSON.parse(
        localStorage.getItem('toonreels_saved_accounts') || '[]'
      );

      // Update or add the account with saved login
      const accountIndex = existingAccounts.findIndex(
        (acc: any) => acc.id === userId
      );

      const savedAccount = {
        id: userId,
        email,
        username,
        avatar_url: avatarUrl,
        selected_avatar: selectedAvatar,
        loginSaved: true,
        // Store a hashed version of the PIN (simple hash for demo - in production use bcrypt)
        pinHash: btoa(pin + userId.slice(0, 8)), // Basic obfuscation
      };

      if (accountIndex >= 0) {
        existingAccounts[accountIndex] = savedAccount;
      } else {
        existingAccounts.push(savedAccount);
      }

      // Keep max 3 accounts
      const limitedAccounts = existingAccounts.slice(0, 3);
      localStorage.setItem(
        'toonreels_saved_accounts',
        JSON.stringify(limitedAccounts)
      );

      toast.success('Login saved! You can now switch accounts quickly.');
      onOpenChange(false);
      onComplete();
    } catch (error) {
      toast.error('Failed to save login');
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = () => {
    // Save account without PIN
    const existingAccounts = JSON.parse(
      localStorage.getItem('toonreels_saved_accounts') || '[]'
    );

    const accountIndex = existingAccounts.findIndex(
      (acc: any) => acc.id === userId
    );

    const savedAccount = {
      id: userId,
      email,
      username,
      avatar_url: avatarUrl,
      selected_avatar: selectedAvatar,
      loginSaved: false,
    };

    if (accountIndex >= 0) {
      existingAccounts[accountIndex] = savedAccount;
    } else {
      existingAccounts.push(savedAccount);
    }

    const limitedAccounts = existingAccounts.slice(0, 3);
    localStorage.setItem(
      'toonreels_saved_accounts',
      JSON.stringify(limitedAccounts)
    );

    onOpenChange(false);
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="flex items-center justify-center mb-2">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <Shield className="h-6 w-6 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center">Save Login?</DialogTitle>
          <DialogDescription className="text-center">
            Set a 4-digit PIN to quickly switch to this account without entering your password again.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label htmlFor="pin">Create PIN</Label>
            <div className="relative">
              <Input
                id="pin"
                type={showPin ? 'text' : 'password'}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                placeholder="Enter 4-digit PIN"
                maxLength={4}
                inputMode="numeric"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPin">Confirm PIN</Label>
            <Input
              id="confirmPin"
              type={showPin ? 'text' : 'password'}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="Confirm 4-digit PIN"
              maxLength={4}
              inputMode="numeric"
            />
          </div>

          <div className="flex flex-col gap-2 pt-2">
            <Button onClick={handleSaveLogin} disabled={saving}>
              {saving ? 'Saving...' : 'Save Login'}
            </Button>
            <Button variant="ghost" onClick={handleSkip}>
              Not Now
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default SaveLoginDialog;
