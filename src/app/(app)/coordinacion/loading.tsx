import { SkeletonBlock } from "@/components/skeleton-block";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <SkeletonBlock className="h-7 w-44" />
        <SkeletonBlock className="h-4 w-72" />
      </div>

      {/* Accesos rápidos (Sueldos, Jornadas, Riesgo, Comercial) */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
        <SkeletonBlock className="h-24" />
      </div>

      {/* Panorama de márgenes + tarifas */}
      <SkeletonBlock className="h-72 w-full" />
      <SkeletonBlock className="h-56 w-full" />
    </div>
  );
}
