import { SkeletonBlock } from "@/components/skeleton-block";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonBlock className="h-7 w-40" />
        <SkeletonBlock className="h-4 w-64" />
      </div>

      {/* Árbol del organigrama */}
      <div className="flex justify-center">
        <SkeletonBlock className="h-20 w-56" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-40" />
        <SkeletonBlock className="h-40" />
      </div>
    </div>
  );
}
