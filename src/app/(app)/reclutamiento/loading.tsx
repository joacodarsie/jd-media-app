import { SkeletonBlock } from "@/components/skeleton-block";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-44" />
          <SkeletonBlock className="h-4 w-72" />
        </div>
        <SkeletonBlock className="h-9 w-36" />
      </div>

      {/* Búsquedas activas */}
      <div className="grid gap-4 sm:grid-cols-2">
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-40" />
      </div>
      <SkeletonBlock className="h-64 w-full" />
    </div>
  );
}
