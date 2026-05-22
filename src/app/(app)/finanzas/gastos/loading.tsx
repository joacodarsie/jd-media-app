import { PageSkeleton, SkeletonBlock } from "@/components/skeleton-block";

export default function Loading() {
  return (
    <div className="space-y-5">
      <SkeletonBlock className="h-4 w-24" />
      <div className="space-y-2">
        <SkeletonBlock className="h-7 w-56" />
        <SkeletonBlock className="h-4 w-80" />
      </div>
      <div className="flex flex-wrap gap-2">
        <SkeletonBlock className="h-7 w-24" />
        <SkeletonBlock className="h-7 w-24" />
        <SkeletonBlock className="h-7 w-24" />
        <SkeletonBlock className="h-7 w-32" />
      </div>
      <PageSkeleton withHeader={false} rows={6} />
    </div>
  );
}
