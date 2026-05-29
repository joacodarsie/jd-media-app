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

/** Encabezado típico: título + subtítulo. */
function HeaderSkeleton() {
  return (
    <div className="space-y-2">
      <SkeletonBlock className="h-7 w-52" />
      <SkeletonBlock className="h-4 w-80 max-w-full" />
    </div>
  );
}

/** Skeleton del dashboard "Mi día": hero con mini-stats + bloques en grilla. */
export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-32" />
          <SkeletonBlock className="h-8 w-48" />
          <SkeletonBlock className="h-4 w-40" />
        </div>
        <div className="grid w-full grid-cols-4 gap-3 sm:flex sm:w-auto">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-12 w-full sm:w-16" />
          ))}
        </div>
      </div>
      <SkeletonBlock className="h-20 w-full" />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <SkeletonBlock className="h-4 w-32" />
          {Array.from({ length: 3 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-16 w-full" />
          ))}
        </div>
        <div className="space-y-3">
          <SkeletonBlock className="h-4 w-24" />
          {Array.from({ length: 2 }).map((_, i) => (
            <SkeletonBlock key={i} className="h-14 w-full" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** Skeleton de una grilla de tarjetas (clientes, equipo, etc). */
export function CardGridSkeleton({
  cards = 9,
  columns = 3,
}: {
  cards?: number;
  columns?: 2 | 3 | 4;
}) {
  const cols = {
    2: "sm:grid-cols-2",
    3: "sm:grid-cols-2 lg:grid-cols-3",
    4: "sm:grid-cols-2 lg:grid-cols-4",
  }[columns];
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className={cn("grid gap-3", cols)}>
        {Array.from({ length: cards }).map((_, i) => (
          <SkeletonBlock key={i} className="h-28 w-full" />
        ))}
      </div>
    </div>
  );
}

/** Skeleton de un calendario mensual (grilla 7 columnas). */
export function CalendarSkeleton() {
  return (
    <div className="space-y-5">
      <HeaderSkeleton />
      <div className="flex items-center justify-between">
        <SkeletonBlock className="h-9 w-40" />
        <SkeletonBlock className="h-9 w-28" />
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: 7 }).map((_, i) => (
          <SkeletonBlock key={`h-${i}`} className="h-5 w-full" />
        ))}
        {Array.from({ length: 35 }).map((_, i) => (
          <SkeletonBlock key={`d-${i}`} className="h-24 w-full" />
        ))}
      </div>
    </div>
  );
}
