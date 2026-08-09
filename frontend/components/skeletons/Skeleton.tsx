export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse bg-surface-2 rounded-lg ${className}`} />;
}

export function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <div className={`bg-surface border border-border rounded-2xl p-4 ${className}`}>
      <div className="flex items-center gap-1.5 mb-3">
        <Skeleton className="w-3 h-3 rounded-full" />
        <Skeleton className="h-3 w-16" />
      </div>
      <Skeleton className="h-6 w-20" />
    </div>
  );
}

export function SkeletonText({ className = "h-3 w-full" }: { className?: string }) {
  return <Skeleton className={className} />;
}
