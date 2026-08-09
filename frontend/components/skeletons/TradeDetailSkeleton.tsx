import { Skeleton } from "./Skeleton";

export function TradeDetailSkeleton() {
  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-1 space-y-4">
        <div className="bg-surface border border-border rounded-2xl p-5">
          <Skeleton className="h-7 w-24 mb-2" />
          <Skeleton className="h-4 w-16 mb-4" />
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <Skeleton className="h-3 w-24 mb-3" />
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      <div className="xl:col-span-2 space-y-4">
        <div className="bg-surface border border-border rounded-2xl p-5 h-64">
          <Skeleton className="w-full h-full rounded-xl" />
        </div>
        <div className="bg-surface border border-border rounded-2xl p-5">
          <Skeleton className="h-3 w-32 mb-3" />
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-3/4" />
        </div>
      </div>
    </div>
  );
}
