import { PageSkeleton, SkeletonBlock } from "@/components/skeleton-block";

export default function Loading() {
  return (
    <div className="space-y-5">
      {/* Header del cliente */}
      <div className="space-y-2">
        <SkeletonBlock className="h-4 w-32" />
        <div className="flex items-center justify-between gap-3">
          <SkeletonBlock className="h-7 w-56" />
          <SkeletonBlock className="h-9 w-28" />
        </div>
        <SkeletonBlock className="h-4 w-80" />
      </div>

      {/* Estado + servicios */}
      <SkeletonBlock className="h-20 w-full" />
      <SkeletonBlock className="h-32 w-full" />

      {/* Layout principal */}
      <div className="grid gap-4 md:grid-cols-3">
        <div className="space-y-3 md:col-span-2">
          <SkeletonBlock className="h-6 w-48" />
          <PageSkeleton withHeader={false} rows={3} />
        </div>
        <div className="space-y-3">
          <SkeletonBlock className="h-32 w-full" />
          <SkeletonBlock className="h-32 w-full" />
        </div>
      </div>
    </div>
  );
}
