import { requireUser } from "@/lib/auth";
import { FinanzasTabs } from "@/components/finanzas-tabs";
import { finanzasGrupos } from "@/lib/section-tabs";

export default async function FinanzasLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const me = await requireUser();
  const esAdmin = me.rol === "admin" || me.rol_secundario === "admin";
  return (
    <div>
      <FinanzasTabs grupos={finanzasGrupos(esAdmin)} />
      {children}
    </div>
  );
}
