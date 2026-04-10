import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Search, MessageCircle } from 'lucide-react';
import BottomNav from '@/components/BottomNav';

interface Profile {
  id: string;
  username: string;
  avatar_url: string;
  user_type: string;
}

const Messages = () => {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProfiles();
  }, []);

  const fetchProfiles = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id)
      .limit(20);

    setProfiles(data || []);
  };

  const filteredProfiles = profiles.filter(profile =>
    profile.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto p-4">
        <h1 className="text-2xl font-black mb-6">Messages</h1>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search for creators..."
            className="pl-10"
          />
        </div>

        <div className="space-y-2">
          {filteredProfiles.length === 0 ? (
            <Card className="p-12 text-center">
              <MessageCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No messages yet</p>
              <p className="text-sm text-muted-foreground mt-2">
                Start chatting with other creators!
              </p>
            </Card>
          ) : (
            filteredProfiles.map((profile) => (
              <Card
                key={profile.id}
                className="p-4 hover:shadow-elevated transition-all cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center text-white font-bold text-lg">
                    {profile.username[0].toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-bold">{profile.username}</p>
                    <p className="text-sm text-muted-foreground capitalize">
                      {profile.user_type}
                    </p>
                  </div>
                  <div className="h-2 w-2 rounded-full bg-muted" />
                </div>
              </Card>
            ))
          )}
        </div>
      </div>

      <BottomNav />
    </div>
  );
};

export default Messages;
