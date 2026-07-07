import { SkeletonBlock } from "@/components/skeleton-block";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonBlock className="h-7 w-56" />
        <SkeletonBlock className="h-4 w-80" />
      </div>

      {/* Editor de cláusulas */}
      <SkeletonBlock className="h-40 w-full" />
      <SkeletonBlock className="h-40 w-full" />
      <SkeletonBlock className="h-40 w-full" />
    </div>
  );
}
