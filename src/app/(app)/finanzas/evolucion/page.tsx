import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// La evolución mensual se unificó dentro de Movimientos (vista "Por mes").
// Mantenemos la ruta para bookmarks viejos.
export default function EvolucionRedirect() {
  redirect("/finanzas/movimientos?v=mes");
}
