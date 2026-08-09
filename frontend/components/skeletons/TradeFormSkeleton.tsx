import { Skeleton } from "./Skeleton";

export function TradeFormSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-surface border border-border rounded-2xl p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <Skeleton className="w-7 h-7 rounded-lg" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-9 w-full mb-3" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
      </div>
      <div className="bg-surface border border-border rounded-2xl p-5">
        <div className="flex items-center gap-2.5 mb-4">
          <Skeleton className="w-7 h-7 rounded-lg" />
          <Skeleton className="h-3 w-32" />
        </div>
        <Skeleton className="h-20 w-full mb-3" />
        <Skeleton className="h-20 w-full" />
      </div>
      <Skeleton className="h-12 w-full rounded-2xl" />
    </div>
  );
}
