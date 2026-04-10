import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, BarChart3, Trophy, Users, Sun, Moon, LogOut, Plus, User, ChevronRight, Star } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useTheme } from '@/contexts/ThemeContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import QuickSwitchPinDialog from './QuickSwitchPinDialog';

interface SavedAccount {
  id: string;
  email: string;
  username: string;
  avatar_url: string | null;
  selected_avatar: string | null;
  loginSaved?: boolean;
  pinHash?: string;
}

interface SidebarMoreMenuProps {
  isCreative: boolean;
}

const MAX_ACCOUNTS = 3;

const SidebarMoreMenu = ({ isCreative }: SidebarMoreMenuProps) => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [showAccounts, setShowAccounts] = useState(false);
  const [savedAccounts, setSavedAccounts] = useState<SavedAccount[]>([]);
  const [currentAccountId, setCurrentAccountId] = useState<string | null>(null);
  
  // Quick switch PIN dialog
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [selectedAccountForSwitch, setSelectedAccountForSwitch] = useState<SavedAccount | null>(null);

  useEffect(() => {
    loadAccountsAndCurrentUser();
  }, []);

  const loadAccountsAndCurrentUser = async () => {
    // Load saved accounts from localStorage
    const accounts = localStorage.getItem('toonreels_saved_accounts');
    if (accounts) {
      setSavedAccounts(JSON.parse(accounts));
    }
    
    // Get current user and save to accounts if not already saved
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setCurrentAccountId(user.id);
      
      // Add current account to saved accounts if not already there
      const { data: profile } = await supabase
        .from('profiles')
        .select('username, avatar_url, selected_avatar')
        .eq('id', user.id)
        .single();
      
      if (profile) {
        const existingAccounts = accounts ? JSON.parse(accounts) : [];
        const existingAccount = existingAccounts.find((acc: SavedAccount) => acc.id === user.id);
        
        const currentAccount: SavedAccount = {
          id: user.id,
          email: user.email || '',
          username: profile.username,
          avatar_url: profile.avatar_url,
          selected_avatar: profile.selected_avatar,
          // Preserve loginSaved and pinHash if they exist
          loginSaved: existingAccount?.loginSaved || false,
          pinHash: existingAccount?.pinHash,
        };
        
        if (!existingAccount) {
          const updatedAccounts = [...existingAccounts, currentAccount].slice(0, MAX_ACCOUNTS);
          localStorage.setItem('toonreels_saved_accounts', JSON.stringify(updatedAccounts));
          setSavedAccounts(updatedAccounts);
        } else {
          // Update existing account info but preserve login settings
          const updatedAccounts = existingAccounts.map((acc: SavedAccount) => 
            acc.id === user.id ? currentAccount : acc
          );
          localStorage.setItem('toonreels_saved_accounts', JSON.stringify(updatedAccounts));
          setSavedAccounts(updatedAccounts);
        }
      }
    }
  };

  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast.success('Logged out successfully');
      navigate('/auth');
    } catch (error) {
      toast.error('Failed to log out');
    }
  };

  const handleNavigate = (path: string) => {
    navigate(path);
    setOpen(false);
  };

  const handleSwitchAccount = async (account: SavedAccount) => {
    if (account.id === currentAccountId) {
      toast.info('Already using this account');
      return;
    }

    // If account has saved login with PIN, show PIN dialog
    if (account.loginSaved && account.pinHash) {
      setSelectedAccountForSwitch(account);
      setShowPinDialog(true);
      setOpen(false);
    } else {
      // Sign out current user and redirect to auth with email prefilled
      await supabase.auth.signOut();
      toast.info(`Sign in as ${account.username}`);
      navigate(`/auth?email=${encodeURIComponent(account.email)}`);
      setOpen(false);
    }
  };

  const handlePinSuccess = async (email: string) => {
    setShowPinDialog(false);
    setSelectedAccountForSwitch(null);
    
    // Sign out current user and redirect to auth with email prefilled
    // The PIN verification just confirms they know the PIN - they still need to enter password
    // For true seamless switching, we'd need to store tokens (not recommended for security)
    await supabase.auth.signOut();
    toast.success('PIN verified! Enter your password to complete switch.');
    navigate(`/auth?email=${encodeURIComponent(email)}`);
  };

  const handleUsePassword = async () => {
    setShowPinDialog(false);
    if (selectedAccountForSwitch) {
      await supabase.auth.signOut();
      navigate(`/auth?email=${encodeURIComponent(selectedAccountForSwitch.email)}`);
    }
    setSelectedAccountForSwitch(null);
  };

  const handleAddAccount = async () => {
    if (savedAccounts.length >= MAX_ACCOUNTS) {
      toast.error(`Maximum ${MAX_ACCOUNTS} accounts allowed`);
      return;
    }
    // Sign out and go to auth to add new account
    await supabase.auth.signOut();
    toast.info('Sign in to add another account');
    navigate('/auth');
    setOpen(false);
  };

  const handleRemoveAccount = (accountId: string) => {
    if (accountId === currentAccountId) {
      toast.error('Cannot remove current account');
      return;
    }
    const updatedAccounts = savedAccounts.filter(acc => acc.id !== accountId);
    localStorage.setItem('toonreels_saved_accounts', JSON.stringify(updatedAccounts));
    setSavedAccounts(updatedAccounts);
    toast.success('Account removed');
  };

  return (
    <>
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button className="w-full flex items-center gap-4 px-4 py-3 rounded-xl text-base font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all">
          <Menu className="h-5 w-5" />
          <span>More</span>
        </button>
      </PopoverTrigger>
      <PopoverContent 
        side="top" 
        align="start" 
        className="w-56 p-2 rounded-2xl bg-card border border-border shadow-xl z-[100]"
        sideOffset={8}
      >
        {showAccounts ? (
          <div className="space-y-1">
            {/* Back button */}
            <button 
              onClick={() => setShowAccounts(false)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              ← Back
            </button>
            
            <div className="h-px bg-border my-2" />
            
            {savedAccounts.length > 0 ? (
              <>
                {savedAccounts.map((account) => (
                  <div 
                    key={account.id}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                      account.id === currentAccountId 
                        ? 'bg-primary/10' 
                        : 'hover:bg-muted'
                    }`}
                  >
                    <button
                      onClick={() => handleSwitchAccount(account)}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-lg overflow-hidden flex-shrink-0 border-2 border-border">
                        {account.avatar_url ? (
                          <img src={account.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          account.selected_avatar || <User className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <p className={`truncate font-semibold ${account.id === currentAccountId ? 'text-primary' : 'text-foreground'}`}>
                          {account.username}
                        </p>
                        {account.id === currentAccountId ? (
                          <p className="text-xs text-primary">✓ Active</p>
                        ) : (
                          <p className="text-xs text-muted-foreground">Tap to switch</p>
                        )}
                      </div>
                    </button>
                    {account.id !== currentAccountId && (
                      <button
                        onClick={() => handleRemoveAccount(account.id)}
                        className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                        title="Remove account"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                
                {savedAccounts.length < MAX_ACCOUNTS && (
                  <>
                    <div className="h-px bg-border my-2" />
                    <button 
                      onClick={handleAddAccount}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Plus className="h-5 w-5" />
                      </div>
                      <span>Add Account</span>
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="px-3 py-6 text-center">
                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">No Accounts</p>
                <p className="text-xs text-muted-foreground mb-4">Add up to {MAX_ACCOUNTS} accounts</p>
                <button 
                  onClick={handleAddAccount}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add Account</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {/* ToonlyStudio - Only for Creatives */}
            {isCreative && (
              <button 
                onClick={() => handleNavigate('/toonly-studio')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
              >
                <BarChart3 className="h-4 w-4" />
                <span>ToonlyStudio</span>
              </button>
            )}

            {/* Switch Accounts */}
            <button 
              onClick={() => setShowAccounts(true)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              <div className="flex items-center gap-3">
                <Users className="h-4 w-4" />
                <span>Switch Accounts</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <span>{savedAccounts.length}/{MAX_ACCOUNTS}</span>
                <ChevronRight className="h-3 w-3" />
              </div>
            </button>

            {/* Divider */}
            <div className="h-px bg-border my-2" />

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-foreground hover:bg-muted transition-colors"
            >
              {theme === 'dark' ? (
                <>
                  <Sun className="h-4 w-4" />
                  <span>Light Mode</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4" />
                  <span>Dark Mode</span>
                </>
              )}
            </button>

            {/* Divider */}
            <div className="h-px bg-border my-2" />

            {/* Logout */}
            <button 
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Log out</span>
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>

    {/* Quick Switch PIN Dialog */}
    <QuickSwitchPinDialog
      open={showPinDialog}
      onOpenChange={setShowPinDialog}
      account={selectedAccountForSwitch}
      onSuccess={handlePinSuccess}
      onUsePassword={handleUsePassword}
    />
    </>
  );
};

export default SidebarMoreMenu;
