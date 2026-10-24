import Link from "next/link";
import { createAdmin } from "@/lib/supabase/admin";
import { seguimientoQueToca } from "@/lib/prospecting/seguimiento";

/**
 * Los seguimientos de prospección en Mi día (24/10/2026). Al 24/10 había 1.389
 * contactos a los que se les escribió una vez hace más de 3 días y nunca se
 * les volvió a escribir (0 seguimientos en la semana), mientras la lista de
 * contactos nuevos con WhatsApp ya estaba agotada. El segundo y el tercer
 * mensaje son los que traen las respuestas: esto lo pone a la vista de quien
 * tiene que mandarlos, con un toque a la lista.
 */
export async function SeguimientosPendientes({ userId }: { userId: string }) {
  const { data } = await createAdmin()
    .from("prospecting_contacts")
    .select("estado, contactado_at, seguimientos, seguimiento_at")
    .eq("asignado_a", userId)
    .eq("estado", "contactado")
    .limit(1000);
  const ahora = new Date();
  const toca = ((data ?? []) as { estado: string; contactado_at: string | null; seguimientos: number | null; seguimiento_at: string | null }[]).filter(
    (c) => seguimientoQueToca(c, ahora) != null
  ).length;
  if (!toca) return null;

  return (
    <Link
      href="/captacion"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-2xl border border-amber-500/40 bg-card p-4 transition hover:border-primary md:p-5 animate-in fade-in slide-in-from-bottom-2 duration-500"
    >
      <span className="text-3xl" aria-hidden="true">🔁</span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">
          {toca} seguimiento{toca === 1 ? "" : "s"} para mandar
        </h2>
        <p className="text-xs text-muted-foreground">
          Les escribiste hace 3 días o más y no contestaron. Casi nadie responde el primer mensaje: el segundo es el que trae las respuestas. El texto ya viene escrito.
        </p>
      </div>
      <span className="rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground">Mandar ahora →</span>
    </Link>
  );
}
