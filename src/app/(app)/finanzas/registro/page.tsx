import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// El Registro (planilla mes a mes) se unificó dentro de Movimientos como la
// vista "Planilla (Excel)": era la misma pregunta —mes a mes, entró/salió/
// neto— contada dos veces. Mantenemos la ruta para bookmarks viejos.
export default function RegistroRedirect() {
  redirect("/finanzas/movimientos?v=registro");
}
