import { SkeletonBlock } from "@/components/skeleton-block";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBlock className="h-7 w-32" />
          <SkeletonBlock className="h-4 w-56" />
        </div>
        <SkeletonBlock className="h-16 w-32" />
      </div>

      {/* Margen real */}
      <SkeletonBlock className="h-32 w-full" />

      {/* Las 3 cards de cobros/pagos/gastos */}
      <div className="grid gap-4 lg:grid-cols-3">
        <SkeletonBlock className="h-64" />
        <SkeletonBlock className="h-64" />
        <SkeletonBlock className="h-64" />
      </div>

      <SkeletonBlock className="h-10 w-72" />
    </div>
  );
}
