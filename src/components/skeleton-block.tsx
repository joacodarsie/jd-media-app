import { cn } from "@/lib/utils";

export function SkeletonBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-muted/70 dark:bg-muted/40",
        className
      )}
    />
  );
}

export function PageSkeleton({
  rows = 6,
  withHeader = true,
}: {
  rows?: number;
  withHeader?: boolean;
}) {
  return (
    <div className="space-y-5">
      {withHeader && (
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-44" />
          <SkeletonBlock className="h-4 w-72" />
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, i) => (
          <SkeletonBlock key={i} className="h-14 w-full" />
        ))}
      </div>
    </div>
  );
}
