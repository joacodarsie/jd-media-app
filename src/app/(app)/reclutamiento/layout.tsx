import { requireUser } from "@/lib/auth";
import { SectionTabs } from "@/components/section-tabs";
import { equipoTabs } from "@/lib/section-tabs";

export default async function ReclutamientoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireUser();
  return (
    <div>
      <SectionTabs tabs={equipoTabs(me.rol, me.rol_secundario)} />
      {children}
    </div>
  );
}
