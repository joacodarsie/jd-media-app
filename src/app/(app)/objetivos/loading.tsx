import { SkeletonBlock } from "@/components/skeleton-block";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonBlock className="h-7 w-40" />
        <SkeletonBlock className="h-4 w-80" />
      </div>
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-3">
          <SkeletonBlock className="h-4 w-48" />
          <div className="grid gap-3 md:grid-cols-2">
            <SkeletonBlock className="h-40" />
            <SkeletonBlock className="h-40" />
          </div>
        </div>
      ))}
    </div>
  );
}
