import Link from "next/link";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { armarPlan, ritmoNecesario, type ClienteParaPedir } from "@/lib/captacion/plan";
import { CaptacionLista } from "@/components/captacion-lista";

export const dynamic = "force-dynamic";

const ROLES_OK = ["admin", "coordinador", "comercial", "prospecting"];

/** Días hábiles (lun-vie) entre hoy y una fecha, sin contar hoy. */
function diasHabilesHasta(hoy: Date, hasta: Date): number {
  let d = new Date(hoy);
  let n = 0;
  while (d < hasta) {
    d = new Date(d.getTime() + 86400_000);
    const dia = d.getDay();
    if (dia !== 0 && dia !== 6) n++;
  }
  return n;
}

export default async function CaptacionPage() {
  const me = await requireUser();
  if (!userInRoles(me, ROLES_OK)) {
    return <p className="text-sm text-muted-foreground">Esta sección es del equipo comercial.</p>;
  }

  const admin = createAdmin();
  const [{ data: clientes }, logRes, contactosRes] = await Promise.all([
    admin
      .from("clients")
      .select(
        "id, nombre, estado, contacto_nombre, contacto_telefono, rubro, monto_mensual, fecha_activado, fecha_inactivado, es_interno"
      ),
    admin.from("outreach_log").select("tipo, target_id, resultado"),
    admin.from("prospecting_contacts").select("id, estado, contactado_at, telefono"),
  ]);

  const faltaMigracion = (logRes.error as { code?: string } | null)?.code === "42P01";

  const todos = ((clientes ?? []) as (ClienteParaPedir & {
    estado: string;
    es_interno: boolean;
    fecha_activado: string | null;
    fecha_inactivado: string | null;
  })[]).filter((c) => !c.es_interno);

  const activos: ClienteParaPedir[] = todos
    .filter((c) => c.estado === "activo")
    .map((c) => ({ ...c, fecha: c.fecha_activado }));
  const perdidos: ClienteParaPedir[] = todos
    .filter((c) => c.estado === "perdido")
    .map((c) => ({ ...c, fecha: c.fecha_inactivado }));

  const hoyDate = new Date();
  const hoy = hoyDate.toISOString().slice(0, 10);
  const yaHechos = ((logRes.data ?? []) as { tipo: string; target_id: string }[]).map((l) => ({
    tipo: l.tipo as "referido" | "reactivacion",
    targetId: l.target_id,
  }));

  const plan = armarPlan({ activos, perdidos, yaHechos, hoy });

  // Contactos de prospección que nadie tocó todavía: no se listan acá uno por
  // uno (para eso está el modo despacho), pero sí cuentan como trabajo pendiente.
  const contactos = (contactosRes.data ?? []) as {
    estado: string | null;
    contactado_at: string | null;
    telefono: string | null;
  }[];
  const sinContactar = contactos.filter((c) => !c.contactado_at && c.estado === "nuevo").length;

  // Ritmo: la meta del user es 10 clientes antes del 9/8.
  const ritmo = ritmoNecesario({
    meta: 10,
    yaConseguidos: 0,
    diasHabilesRestantes: diasHabilesHasta(hoyDate, new Date("2026-08-09")),
    altasPorMesHistorico: 5.7,
  });

  const hechos = (logRes.data ?? []).length;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Conseguir clientes</h1>
        <p className="max-w-3xl text-muted-foreground">
          Los canales que ya tenés pagos y sin usar, en una sola lista y ordenados
          por probabilidad de cierre. Cada fila trae el mensaje escrito: abrís
          WhatsApp, mandás y marcás. Nada más.
        </p>
      </div>

      {faltaMigracion && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
          <b>Falta aplicar la migración 0143.</b> Podés usar los mensajes igual,
          pero hasta que la apliques no se puede marcar quién ya fue contactado y
          la lista te lo va a volver a ofrecer mañana.
        </div>
      )}

      <div className="rounded-xl border bg-card p-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Meta al 9/8</p>
            <p className="text-xl font-semibold">10 clientes</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Días hábiles que quedan</p>
            <p className="text-xl font-semibold tabular-nums">
              {diasHabilesHasta(hoyDate, new Date("2026-08-09"))}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Hacen falta por día</p>
            <p className="text-xl font-semibold tabular-nums">{ritmo.porDia}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tu ritmo histórico</p>
            <p className="text-xl font-semibold tabular-nums text-amber-600 dark:text-amber-400">
              {ritmo.ritmoHistoricoPorDia} / día
            </p>
          </div>
        </div>
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          Cerrás 5,7 clientes por mes. Diez en {diasHabilesHasta(hoyDate, new Date("2026-08-09"))}{" "}
          días hábiles es <b>{Math.round((ritmo.porDia / ritmo.ritmoHistoricoPorDia) * 10) / 10}×</b>{" "}
          tu ritmo. No es para desanimarte: es para que sepas que sale de hacer
          TODAS las filas de abajo, no de esperar que entre solo.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Bloque
          titulo="Pedir referidos"
          cantidad={plan.filter((a) => a.tipo === "referido").length}
          detalle="Clientes activos a los que nunca les pediste una recomendación. El canal que más convierte y sale $0."
        />
        <Bloque
          titulo="Reactivar perdidos"
          cantidad={plan.filter((a) => a.tipo === "reactivacion").length}
          detalle="Ya conocen el producto y saben cuánto cuesta. El ciclo de decisión es la mitad."
        />
        <Bloque
          titulo="Contactos sin tocar"
          cantidad={sinContactar}
          detalle="Cargados y nunca contactados. Se trabajan desde el modo despacho de Contactos."
          href="/prospeccion"
        />
      </div>

      {hechos > 0 && (
        <p className="text-xs text-muted-foreground">
          Ya trabajaste <b>{hechos}</b> de esta lista. Los que marcaste no vuelven a
          aparecer.
        </p>
      )}

      <CaptacionLista acciones={plan} />

      <p className="text-xs text-muted-foreground">
        ¿Se te acabó la lista? Cargá contactos nuevos con{" "}
        <Link href="/prospeccion" className="underline">
          Google Maps verificado
        </Link>{" "}
        (gratis hasta 500 búsquedas por mes) y armá la cola de{" "}
        <Link href="/prospeccion/email" className="underline">
          email en frío
        </Link>
        .
      </p>
    </div>
  );
}

function Bloque({
  titulo,
  cantidad,
  detalle,
  href,
}: {
  titulo: string;
  cantidad: number;
  detalle: string;
  href?: string;
}) {
  const inner = (
    <div className="h-full rounded-xl border bg-card p-4">
      <p className="text-sm font-semibold">{titulo}</p>
      <p className="mt-1 text-3xl font-bold tabular-nums">{cantidad}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detalle}</p>
    </div>
  );
  return href ? (
    <Link href={href} className="block hover:opacity-90">
      {inner}
    </Link>
  ) : (
    inner
  );
}
