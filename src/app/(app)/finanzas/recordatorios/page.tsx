import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Los recordatorios se unificaron dentro de Cobros (vista "Recordatorios
// WhatsApp"). Mantenemos la ruta para bookmarks y notificaciones viejas.
export default function RecordatoriosRedirect({
  searchParams,
}: {
  searchParams: { m?: string };
}) {
  const m = searchParams.m && /^\d{4}-\d{2}$/.test(searchParams.m) ? searchParams.m : null;
  redirect(`/finanzas/cobros?v=recordatorios${m ? `&m=${m}` : ""}`);
}
