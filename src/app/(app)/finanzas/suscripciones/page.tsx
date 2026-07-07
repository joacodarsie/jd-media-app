import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// Las suscripciones se unificaron dentro de Gastos (vista "Suscripciones").
// Mantenemos la ruta para bookmarks viejos. Las actions siguen en esta carpeta.
export default function SuscripcionesRedirect() {
  redirect("/finanzas/gastos?v=subs");
}
