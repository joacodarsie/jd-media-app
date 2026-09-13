import { requireUser } from "@/lib/auth";
import { FinanzasTabs } from "@/components/finanzas-tabs";
import { finanzasGrupos } from "@/lib/section-tabs";

// "¿Quién me pagó?" vive afuera de /finanzas pero es la primera pestaña del
// grupo "qué entra y qué sale": lleva las mismas pestañas para que se pueda
// saltar de acá al resto sin volver a un menú.
export default async function CobrosLayout({
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
