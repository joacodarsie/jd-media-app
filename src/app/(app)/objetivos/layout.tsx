import { requireUser } from "@/lib/auth";
import { SectionTabs } from "@/components/section-tabs";
import { metricasTabs } from "@/lib/section-tabs";

export default async function ObjetivosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireUser();
  const permisos = (me as unknown as { permisos?: Record<string, boolean> }).permisos;
  const showGlobal = me.rol === "admin" || permisos?.global === true;
  return (
    <div>
      <SectionTabs tabs={metricasTabs(showGlobal)} />
      {children}
    </div>
  );
}
