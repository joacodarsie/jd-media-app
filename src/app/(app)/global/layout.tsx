import { requireUser, userHas } from "@/lib/auth";
import { SectionTabs } from "@/components/section-tabs";
import { metricasTabs, puedeVerMaquina } from "@/lib/section-tabs";

export default async function GlobalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireUser();
  const permisos = (me as unknown as { permisos?: Record<string, boolean> }).permisos;
  const showGlobal = me.rol === "admin" || permisos?.global === true;
  const showMaquina = puedeVerMaquina(me.rol, me.rol_secundario) || userHas(me, "comercial");
  return (
    <div>
      <SectionTabs tabs={metricasTabs(showGlobal, showMaquina)} />
      {children}
    </div>
  );
}
