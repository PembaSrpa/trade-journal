import { Skeleton } from "./Skeleton";

export function NotebookEntriesSkeleton() {
  return (
    <div className="columns-1 xl:columns-2 gap-4 [&>*]:break-inside-avoid [&>*]:mb-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-surface border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-3 w-12" />
          </div>
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-3 w-5/6 mb-2" />
          <Skeleton className="h-3 w-2/3" />
        </div>
      ))}
    </div>
  );
}
