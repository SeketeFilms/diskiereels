import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { HardDrive, Video, Image, Users, Trash2, RefreshCw, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface StorageStats {
  totalVideos: number;
  totalVideoSize: number;
  totalAvatars: number;
  totalAvatarSize: number;
  totalThumbnails: number;
  totalThumbnailSize: number;
  totalSize: number;
  lastCleanup: string | null;
  orphanedRecords: number;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

const StorageAnalytics = () => {
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [cleaning, setCleaning] = useState(false);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('storage-analytics');
      
      if (error) throw error;
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch storage stats:', error);
      toast.error('Failed to load storage analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const runCleanup = async () => {
    setCleaning(true);
    try {
      const { data, error } = await supabase.functions.invoke('cleanup-orphaned-videos', {
        body: {},
      });
      
      // If we need to delete, call with delete parameter
      if (stats?.orphanedRecords && stats.orphanedRecords > 0) {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/cleanup-orphaned-videos?delete=true`,
          {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
              'Content-Type': 'application/json',
            },
          }
        );
        const result = await response.json();
        
        if (result.deletedVideos) {
          toast.success(`Cleaned up ${result.deletedVideos.length} orphaned records`);
        }
      } else {
        toast.info('No orphaned records to clean');
      }
      
      // Refresh stats
      await fetchStats();
    } catch (error) {
      console.error('Cleanup failed:', error);
      toast.error('Failed to run cleanup');
    } finally {
      setCleaning(false);
    }
  };

  // Estimate storage limit (free tier is typically 1GB)
  const storageLimit = 1024 * 1024 * 1024; // 1GB
  const usagePercentage = stats ? Math.min((stats.totalSize / storageLimit) * 100, 100) : 0;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center gap-2">
            <RefreshCw className="h-4 w-4 animate-spin" />
            <span className="text-sm text-muted-foreground">Loading storage analytics...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <HardDrive className="h-4 w-4" />
            Storage Usage
          </CardTitle>
          <CardDescription className="text-xs">
            Total cloud storage being used
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>{formatBytes(stats?.totalSize || 0)}</span>
              <span className="text-muted-foreground">{formatBytes(storageLimit)}</span>
            </div>
            <Progress value={usagePercentage} className="h-2" />
            <p className="text-xs text-muted-foreground text-right">
              {usagePercentage.toFixed(1)}% used
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Video className="h-4 w-4 mx-auto mb-1 text-fun-blue" />
              <p className="text-lg font-bold">{stats?.totalVideos || 0}</p>
              <p className="text-[10px] text-muted-foreground">Videos</p>
              <p className="text-[10px] font-medium">{formatBytes(stats?.totalVideoSize || 0)}</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Image className="h-4 w-4 mx-auto mb-1 text-fun-green" />
              <p className="text-lg font-bold">{stats?.totalThumbnails || 0}</p>
              <p className="text-[10px] text-muted-foreground">Thumbnails</p>
              <p className="text-[10px] font-medium">{formatBytes(stats?.totalThumbnailSize || 0)}</p>
            </div>
            <div className="text-center p-3 bg-muted/50 rounded-lg">
              <Users className="h-4 w-4 mx-auto mb-1 text-fun-coral" />
              <p className="text-lg font-bold">{stats?.totalAvatars || 0}</p>
              <p className="text-[10px] text-muted-foreground">Avatars</p>
              <p className="text-[10px] font-medium">{formatBytes(stats?.totalAvatarSize || 0)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Trash2 className="h-4 w-4" />
            Database Cleanup
          </CardTitle>
          <CardDescription className="text-xs">
            Remove orphaned records and optimize storage
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {stats?.orphanedRecords && stats.orphanedRecords > 0 ? (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <div className="flex-1">
                <p className="text-sm font-medium">{stats.orphanedRecords} orphaned records found</p>
                <p className="text-xs text-muted-foreground">These records reference missing files</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 p-3 bg-fun-green/10 rounded-lg">
              <HardDrive className="h-4 w-4 text-fun-green" />
              <div className="flex-1">
                <p className="text-sm font-medium">Database is clean</p>
                <p className="text-xs text-muted-foreground">No orphaned records detected</p>
              </div>
            </div>
          )}

          {stats?.lastCleanup && (
            <p className="text-xs text-muted-foreground">
              Last cleanup: {new Date(stats.lastCleanup).toLocaleDateString()}
            </p>
          )}

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={fetchStats}
              disabled={loading}
              className="flex-1"
            >
              <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button 
              variant="destructive" 
              size="sm" 
              onClick={runCleanup}
              disabled={cleaning || !stats?.orphanedRecords}
              className="flex-1"
            >
              <Trash2 className={`h-3 w-3 mr-1 ${cleaning ? 'animate-spin' : ''}`} />
              {cleaning ? 'Cleaning...' : 'Run Cleanup'}
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Automatic cleanup runs weekly to remove orphaned data
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default StorageAnalytics;
