import { Skeleton } from "./Skeleton";

export function JournalSkeleton() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 mb-6">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-3 w-40 mb-3" />
          <div className="flex gap-1.5">
            <Skeleton className="h-5 w-14 rounded-full" />
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
}
