import { SkeletonBlock } from "@/components/skeleton-block";

export default function Loading() {
  return (
    <div className="mx-auto max-w-3xl space-y-4 py-4">
      <SkeletonBlock className="h-8 w-1/3" />
      <SkeletonBlock className="h-4 w-2/3" />
      <SkeletonBlock className="h-64 w-full" />
    </div>
  );
}
