import { SkeletonBlock } from "@/components/skeleton-block";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonBlock className="h-7 w-36" />
        <SkeletonBlock className="h-4 w-72" />
      </div>

      {/* KPIs de inversión */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
      </div>

      {/* Tabla de cuentas */}
      <SkeletonBlock className="h-96 w-full" />
    </div>
  );
}
