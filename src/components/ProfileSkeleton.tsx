import { Skeleton } from '@/components/ui/skeleton';

const ProfileSkeleton = () => {
  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="max-w-2xl mx-auto">
        {/* Header Skeleton */}
        <div className="relative h-64 overflow-hidden rounded-3xl mx-4 mt-4">
          <Skeleton className="absolute inset-0 w-full h-full" />
          
          {/* Profile content overlay */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <div className="flex items-end gap-4">
              {/* Avatar skeleton */}
              <Skeleton className="h-20 w-20 rounded-2xl shrink-0" />
              
              {/* User info skeleton */}
              <div className="flex-1 space-y-2">
                <Skeleton className="h-6 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          </div>
        </div>

        {/* Stats Section Skeleton */}
        <div className="px-4 mt-4">
          <div className="flex justify-around gap-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex flex-col items-center">
                <Skeleton className="h-6 w-12 mb-1" />
                <Skeleton className="h-3 w-16" />
              </div>
            ))}
          </div>
        </div>

        {/* Action Buttons Skeleton */}
        <div className="px-4 mt-4 flex gap-2">
          <Skeleton className="h-10 flex-1 rounded-xl" />
          <Skeleton className="h-10 w-10 rounded-xl" />
        </div>

        {/* Videos Grid Skeleton */}
        <div className="px-4 mt-6">
          <Skeleton className="h-6 w-24 mb-4" />
          <div className="grid grid-cols-3 gap-1">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="aspect-[9/16] rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSkeleton;
