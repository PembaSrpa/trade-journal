import { Skeleton, SkeletonCard } from "./Skeleton";

export function OverviewSkeleton() {
  return (
    <div className="w-full">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 mb-6 items-start">
        <div className="xl:col-span-3">
          <Skeleton className="h-3 w-24 mb-3" />
          <div className="bg-surface border border-border rounded-2xl p-4 h-[26rem]">
            <Skeleton className="w-full h-full rounded-xl" />
          </div>
        </div>
        <div className="xl:col-span-2">
          <Skeleton className="h-3 w-20 mb-3" />
          <div className="bg-surface border border-border rounded-2xl p-4">
            <Skeleton className="w-full max-w-[420px] mx-auto h-[22rem] rounded-xl" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  );
}
