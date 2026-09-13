import Link from "next/link";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { armarPlan, ritmoNecesario, type ClienteParaPedir } from "@/lib/captacion/plan";
import { colaDelDia, diasDeCola, type ContactoFrio } from "@/lib/captacion/cola-fria";
import { metaDe } from "@/lib/prospecting/actividad";
import { mensajeElegido, type CampaignMessages } from "@/lib/prospecting/shared";
import { META_CLIENTES, META_DEADLINE } from "@/lib/comercial/machine-kpis";
import { hoyYmd } from "@/lib/dates";
import { CaptacionLista } from "@/components/captacion-lista";
import {
  ColaFriaDespacho,
  type MensajesPorCampana,
} from "@/components/cola-fria-despacho";

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

/**
 * Altas NETAS por mes de los últimos 90 días: el ritmo real, no el de memoria.
 *
 * Netas y no brutas a propósito, igual que el tablero de la Máquina de clientes.
 * Contando solo altas, septiembre daba 2,2 por mes y la pantalla decía "llegás";
 * con las bajas del mismo período el ritmo real es menos de 1. Un número que
 * ignora las bajas siempre miente para el lado lindo.
 */
function altasNetasPorMes(
  altasFechas: (string | null)[],
  bajasFechas: (string | null)[],
  ahora: Date
): number {
  const desde = new Date(ahora.getTime() - 90 * 86400_000);
  const enVentana = (f: string | null) => {
    if (!f) return false;
    const t = new Date(f).getTime();
    return !Number.isNaN(t) && t >= desde.getTime() && t <= ahora.getTime();
  };
  const netas = altasFechas.filter(enVentana).length - bajasFechas.filter(enVentana).length;
  return Math.round((netas / 3) * 10) / 10;
}

export default async function CaptacionPage() {
  const me = await requireUser();
  if (!userInRoles(me, ROLES_OK)) {
    return <p className="text-sm text-muted-foreground">Esta sección es del equipo comercial.</p>;
  }

  const admin = createAdmin();
  const [{ data: clientes }, logRes, contactosRes, campsRes, miRes, sinTocarRes] = await Promise.all([
    admin
      .from("clients")
      .select(
        "id, nombre, estado, contacto_nombre, contacto_telefono, rubro, monto_mensual, fecha_activado, fecha_inactivado, es_interno"
      ),
    admin.from("outreach_log").select("tipo, target_id, resultado"),
    // Solo los MÍOS, no los 1.090 de la tabla: PostgREST corta en 1.000 filas y
    // sin filtro la cola aparecía incompleta (592 de 682) sin avisar nada.
    admin
      .from("prospecting_contacts")
      .select(
        "id, campaign_id, empresa, contacto_nombre, contacto_rol, telefono, instagram, sitio_web, estado, asignado_a, contactado_at, contactable"
      )
      .eq("asignado_a", me.id),
    admin.from("prospecting_campaigns").select("id, mensajes_plantilla"),
    admin.from("users").select("meta_prospeccion").eq("id", me.id).maybeSingle(),
    // El total sin tocar de TODA la agencia va por count, no trayendo las filas:
    // es un número, no una lista, y así no lo corta el tope de 1.000.
    admin
      .from("prospecting_contacts")
      .select("id", { count: "exact", head: true })
      .eq("estado", "nuevo")
      .is("contactado_at", null),
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

  // Contactos de prospección. Los propios se despachan acá abajo; el total sin
  // tocar es el trabajo que hay cargado y nadie está haciendo.
  const contactos = (contactosRes.data ?? []) as ContactoFrio[];
  const sinContactar = sinTocarRes.count ?? 0;

  // La cola propia: la de esta persona, cruzando todas las campañas.
  const mia = colaDelDia({
    contactos,
    userId: me.id,
    meta: metaDe(me.email, (miRes.data as { meta_prospeccion?: number | null } | null)?.meta_prospeccion),
    hoy: hoyYmd(),
  });
  const diasQueQuedan = diasDeCola(mia.pendientesTotal, mia.meta);

  // El mensaje elegido de cada campaña, para no resolverlo en el cliente.
  const mensajes: MensajesPorCampana = {};
  for (const c of (campsRes.data ?? []) as {
    id: string;
    mensajes_plantilla: CampaignMessages | null;
  }[]) {
    const el = mensajeElegido(c.mensajes_plantilla);
    if (el) mensajes[c.id] = { texto: el.texto, label: el.label };
  }

  // Ritmo contra la meta de cuentas, que es la MISMA que la del tablero de la
  // Máquina de clientes (una sola meta en toda la app) y con el ritmo real de
  // los últimos 90 días, no un número escrito a mano que envejece.
  const deadline = new Date(`${META_DEADLINE}T23:59:59`);
  const diasHabiles = diasHabilesHasta(hoyDate, deadline);
  const ritmo = ritmoNecesario({
    meta: META_CLIENTES,
    yaConseguidos: activos.length,
    diasHabilesRestantes: diasHabiles,
    altasPorMesHistorico: altasNetasPorMes(
      todos.map((c) => c.fecha_activado),
      todos.map((c) => c.fecha_inactivado),
      hoyDate
    ),
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
            <p className="text-xs text-muted-foreground">Meta al 31/12</p>
            <p className="text-xl font-semibold tabular-nums">
              {activos.length}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                de {META_CLIENTES}
              </span>
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Días hábiles que quedan</p>
            <p className="text-xl font-semibold tabular-nums">{diasHabiles}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Cuentas nuevas por mes</p>
            <p className="text-xl font-semibold tabular-nums">
              {Math.round(ritmo.porDia * 22 * 10) / 10}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Tu ritmo neto (90 días)</p>
            <p
              className={
                "text-xl font-semibold tabular-nums " +
                (ritmo.alcanza
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-amber-600 dark:text-amber-400")
              }
            >
              {Math.round(ritmo.ritmoHistoricoPorDia * 22 * 10) / 10} / mes
            </p>
          </div>
        </div>
        <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">
          Faltan <b>{ritmo.faltan}</b> cuentas en {diasHabiles} días hábiles, o sea{" "}
          <b>{Math.round(ritmo.porDia * 22 * 10) / 10} altas netas por mes</b>.{" "}
          {ritmo.alcanza
            ? "Al ritmo de los últimos 90 días llegás: sostenerlo es todo el trabajo."
            : "Tu ritmo de los últimos 90 días no alcanza. Sale de hacer TODAS las filas de abajo, no de esperar que entre solo."}
        </p>
      </div>

      {/* La cola propia de contactos fríos: la pieza que faltaba para que la
          lista cargada se trabaje. Va arriba de referidos porque es el volumen. */}
      <ColaFriaDespacho
        cola={mia.cola}
        seguimientos={mia.seguimientos}
        mensajes={mensajes}
        hechosHoy={mia.hechosHoy}
        faltanHoy={mia.faltanHoy}
        meta={mia.meta}
        pendientesTotal={mia.pendientesTotal}
        conWhatsapp={mia.conWhatsapp}
      />

      {diasQueQuedan != null && diasQueQuedan <= 3 && mia.pendientesTotal > 0 && (
        <p className="text-xs text-amber-600 dark:text-amber-400">
          A tu ritmo te quedan <b>{diasQueQuedan}</b> días de cola. Conviene cargar
          contactos nuevos antes de que se vacíe.
        </p>
      )}

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
