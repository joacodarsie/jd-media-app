import { requireUser } from "@/lib/auth";
import { SectionTabs } from "@/components/section-tabs";
import { coordinacionTabs } from "@/lib/section-tabs";

export default async function DirectorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireUser();
  return (
    <div>
      {/* Las pestañas de Coordinación son de admin; un coordinador entra a
          Director IA directo desde el menú, sin la barra. */}
      {me.rol === "admin" && <SectionTabs tabs={coordinacionTabs} />}
      {children}
    </div>
  );
}
