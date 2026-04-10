import { Skeleton } from '@/components/ui/skeleton';

const VideoSkeleton = () => {
  return (
    <div 
      className="relative w-full bg-black snap-start snap-always flex items-center justify-center"
      style={{ height: '100vh', scrollSnapAlign: 'start' }}
    >
      {/* Video placeholder */}
      <Skeleton className="w-full h-full max-h-[calc(100vh-80px)] bg-muted/20" />
      
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
      
      {/* Volume Control skeleton */}
      <Skeleton className="absolute top-4 right-3 z-20 rounded-full h-8 w-8 bg-muted/30" />
      
      {/* Video Info skeleton */}
      <div className="absolute left-2 right-14 z-10" style={{ bottom: '100px' }}>
        <div className="flex items-center gap-1.5 mb-2">
          <Skeleton className="h-6 w-6 rounded-full bg-muted/30" />
          <Skeleton className="h-4 w-24 bg-muted/30" />
          <Skeleton className="h-5 w-16 rounded-full bg-muted/30" />
        </div>
        <Skeleton className="h-3 w-3/4 bg-muted/30 mb-1" />
        <Skeleton className="h-3 w-1/2 bg-muted/30" />
      </div>
      
      {/* Action Buttons skeleton */}
      <div className="absolute right-1 flex flex-col gap-3 z-10" style={{ bottom: '100px' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col items-center gap-1">
            <Skeleton className="rounded-full h-9 w-9 bg-muted/30" />
            <Skeleton className="h-2 w-6 bg-muted/30" />
          </div>
        ))}
      </div>
      
      {/* Loading spinner in center */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary border-t-transparent" />
      </div>
    </div>
  );
};

export default VideoSkeleton;