import Link from "next/link";
import { CheckCircle2, Clock, Inbox } from "lucide-react";
import { createAdmin } from "@/lib/supabase/admin";
import { personasClave } from "@/lib/tareas/personas-clave";
import { formatTicket } from "@/lib/tareas/tickets";
import { AREAS_DE_LA_PM, estadoAprobacion } from "@/lib/tareas/puerta";
import { cn } from "@/lib/utils";

interface Fila {
  id: string;
  numero: number | null;
  titulo: string;
  fecha_limite: string | null;
  revision_desde?: string | null;
  cliente: { nombre: string } | null;
  asignado: { nombre: string } | null;
  creador: { nombre: string } | null;
}

const SELECT =
  "id, numero, titulo, fecha_limite, revision_desde, cliente:clients(nombre), asignado:users!tasks_asignado_a_id_fkey(nombre), creador:users!tasks_creado_por_id_fkey(nombre)";

/**
 * Las dos bandejas del sistema de tickets, arriba de /tareas.
 *
 * - **Para repartir** (la PM): lo que le pidieron y todavía no le pasó a nadie.
 * - **Para aprobar** (la directora): lo que está esperando su visto bueno, con
 *   el reloj de las 24 horas hábiles.
 *
 * La dirección ve las dos, para saber dónde se traba el circuito. El resto no
 * ve nada: no tiene nada que hacer acá.
 */
export async function BandejaCoordinacion({ me }: { me: { id: string; rol: string } }) {
  const clave = await personasClave();
  const soyPm = me.id === clave.pmId;
  const soyDirectora = me.id === clave.directoraId;
  const soyAdmin = me.rol === "admin";
  if (!soyPm && !soyDirectora && !soyAdmin) return null;

  const admin = createAdmin();
  const [repartirRes, aprobarRes] = await Promise.all([
    (soyPm || soyAdmin) && clave.pmId
      ? admin
          .from("tasks")
          .select(SELECT)
          .eq("asignado_a_id", clave.pmId)
          .neq("creado_por_id", clave.pmId)
          .in("area", AREAS_DE_LA_PM)
          .in("estado", ["pendiente", "bloqueada"])
          .order("fecha_limite", { ascending: true })
          .limit(30)
      : Promise.resolve({ data: [], error: null }),
    (soyDirectora || soyAdmin) && clave.directoraId
      ? admin
          .from("tasks")
          .select(SELECT)
          .eq("estado", "en_revision")
          .eq("aprobador_id", clave.directoraId)
          .order("revision_desde", { ascending: true })
          .limit(30)
      : Promise.resolve({ data: [], error: null }),
  ]);

  // Sin la 0173 la columna revision_desde no existe: la bandeja no se muestra.
  if (repartirRes.error || aprobarRes.error) return null;
  const repartir = (repartirRes.data ?? []) as unknown as Fila[];
  const aprobar = (aprobarRes.data ?? []) as unknown as Fila[];
  if (!repartir.length && !aprobar.length) return null;

  const pm = clave.pmNombre?.split(" ")[0] ?? "la PM";
  const directora = clave.directoraNombre?.split(" ")[0] ?? "la directora";

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {aprobar.length > 0 && (
        <Bandeja
          icono={<CheckCircle2 className="h-4 w-4 text-amber-600" />}
          titulo={soyDirectora ? "Para aprobar" : `Esperando aprobación de ${directora}`}
          ayuda="Aprobá o pedí cambios dentro de las 24 horas hábiles."
          filas={aprobar}
          render={(f) => {
            const e = f.revision_desde ? estadoAprobacion(f.revision_desde) : null;
            return (
              <>
                <span className="truncate text-muted-foreground">{f.asignado?.nombre ?? "—"}</span>
                {e && (
                  <span
                    className={cn(
                      "inline-flex shrink-0 items-center gap-1 text-xs",
                      e.vencida ? "font-medium text-red-600" : "text-amber-700"
                    )}
                  >
                    <Clock className="h-3 w-3" />
                    {e.texto}
                  </span>
                )}
              </>
            );
          }}
        />
      )}
      {repartir.length > 0 && (
        <Bandeja
          icono={<Inbox className="h-4 w-4 text-primary" />}
          titulo={soyPm ? "Para repartir" : `Esperando que ${pm} reparta`}
          ayuda="Abrí cada pedido y asignalo a quien lo va a hacer."
          filas={repartir}
          render={(f) => (
            <>
              <span className="truncate text-muted-foreground">pidió {f.creador?.nombre?.split(" ")[0] ?? "—"}</span>
              {f.fecha_limite && (
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {f.fecha_limite.slice(8, 10)}/{f.fecha_limite.slice(5, 7)}
                </span>
              )}
            </>
          )}
        />
      )}
    </div>
  );
}

function Bandeja({
  icono,
  titulo,
  ayuda,
  filas,
  render,
}: {
  icono: React.ReactNode;
  titulo: string;
  ayuda: string;
  filas: Fila[];
  render: (f: Fila) => React.ReactNode;
}) {
  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        {icono}
        <h2 className="text-sm font-semibold">
          {titulo} <span className="font-normal text-muted-foreground">({filas.length})</span>
        </h2>
      </div>
      <ul className="divide-y">
        {filas.slice(0, 6).map((f) => (
          <li key={f.id}>
            <Link
              href={`/tareas/${f.id}`}
              className="flex items-center gap-2 px-4 py-2 text-sm transition-colors hover:bg-accent"
            >
              <span className="w-14 shrink-0 font-mono text-[11px] text-muted-foreground">
                {formatTicket(f.numero) ?? "—"}
              </span>
              <span className="min-w-0 flex-1 truncate">
                {f.titulo}
                {/* Las tareas del calendario ya traen la cuenta en el título. */}
                {f.cliente && !f.titulo.includes(f.cliente.nombre) && (
                  <span className="text-muted-foreground"> · {f.cliente.nombre}</span>
                )}
              </span>
              {render(f)}
            </Link>
          </li>
        ))}
      </ul>
      <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        {filas.length > 6 ? `Y ${filas.length - 6} más. ` : ""}
        {ayuda}
      </p>
    </section>
  );
}
