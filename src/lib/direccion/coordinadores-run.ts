import type { SupabaseClient } from "@supabase/supabase-js";
import { personasClave } from "@/lib/tareas/personas-clave";
import { AREA_DIRECCION } from "./rutina";
import { AREAS_DE_LA_PM, estadoAprobacion } from "@/lib/tareas/puerta";
import { todosLosContactos } from "@/lib/prospecting/contactos-db";
import { metaDe, resumirActividad, type ContactoActividad } from "@/lib/prospecting/actividad";
import { cargarCuentasNuevas } from "@/lib/retencion/cuentas-nuevas-run";
import { tableroCuentasNuevas } from "@/lib/retencion/cuentas-nuevas";
import { arranquesPorCuenta, cargarPanoramaArranques } from "@/lib/retencion/onboarding-panorama-run";
import {
  diasHabilesHastaHoy,
  ordenarTarjetas,
  tarjetaComercial,
  tarjetaCuentaJd,
  tarjetaDireccionCreativa,
  tarjetaPm,
  tarjetaPaidMedia,
  tarjetaCoordGeneral,
  tarjetaGenerica,
  type Comunes,
  type Puesto,
  type AvanceServicio,
  type Tarjeta,
} from "./coordinadores";

type TareaAbierta = {
  id: string;
  titulo: string;
  numero: number | null;
  asignado_a_id: string | null;
  creado_por_id: string | null;
  cliente_id: string | null;
  rutina_key: string | null;
  fecha_limite: string | null;
  estado: string;
  area: string | null;
  created_at: string;
};

/** Lo que la dirección le pidió a alguien y sigue abierto. */
export interface Pedido {
  id: string;
  numero: number | null;
  titulo: string;
  fecha_limite: string | null;
  vencido: boolean;
}

export interface Tablero {
  tarjetas: Tarjeta[];
  pedidos: Record<string, Pedido[]>;
}

async function tareasAbiertas(admin: SupabaseClient): Promise<TareaAbierta[]> {
  const out: TareaAbierta[] = [];
  for (let desde = 0; ; desde += 1000) {
    const { data, error } = await admin
      .from("tasks")
      .select("id, titulo, numero, asignado_a_id, creado_por_id, cliente_id, rutina_key, fecha_limite, estado, area, created_at")
      .not("estado", "in", "(completada,archivada)")
      .order("id")
      .range(desde, desde + 999);
    if (error) throw error;
    out.push(...((data ?? []) as TareaAbierta[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

/** Cuántas tareas del mes de un servicio aparte se hicieron (rutina "<periodo>:<clave>:<cliente>"). */
async function avanceServicio(admin: SupabaseClient, hoy: string, claves: string[]): Promise<AvanceServicio> {
  const { data } = await admin
    .from("tasks")
    .select("estado, fecha_limite")
    .or(claves.map((c) => `rutina_key.like.${hoy.slice(0, 7)}:${c}:%`).join(","));
  const lista = (data ?? []) as { estado: string; fecha_limite: string | null }[];
  const abierta = (t: { estado: string }) => t.estado !== "completada" && t.estado !== "archivada";
  return {
    hechas: lista.filter((t) => t.estado === "completada").length,
    total: lista.filter((t) => t.estado !== "archivada").length,
    vencidas: lista.filter((t) => abierta(t) && !!t.fecha_limite && t.fecha_limite < hoy).length,
  };
}

/**
 * Arma el tablero de los coordinadores. Con `soloPersona`, solo su tarjeta (es
 * lo que ve cada uno en su Mi día), pero se calcula igual que para el dueño.
 */
export async function cargarTablero(
  admin: SupabaseClient,
  hoy: string,
  soloPersona?: string
): Promise<Tablero> {
  const ahora = new Date();
  const [clave, { data: usersRaw }, { data: internas }, tareas] = await Promise.all([
    personasClave(),
    admin.from("users").select("id, nombre, email, rol, area, area_secundaria, meta_prospeccion").eq("activo", true),
    admin.from("clients").select("id, cm_id").eq("es_interno", true),
    tareasAbiertas(admin),
  ]);
  const users = (usersRaw ?? []) as {
    id: string;
    nombre: string;
    email: string | null;
    rol: string;
    area: string | null;
    area_secundaria: string | null;
    meta_prospeccion: number | null;
  }[];
  const nombre = (id: string) => users.find((u) => u.id === id)?.nombre ?? "—";
  // La dirección es quien ocupa Estrategia/Dirección (el dueño); si no hay, los admin.
  const duenos = users.filter((u) => u.area === AREA_DIRECCION);
  const direccion = new Set((duenos.length ? duenos : users.filter((u) => u.rol === "admin")).map((u) => u.id));
  const tieneArea = (u: (typeof users)[number], a: string) => u.area === a || u.area_secundaria === a;

  // Quiénes son los coordinadores. Una persona, una tarjeta (la primera que le toque).
  const puestos: { id: string; puesto: Puesto }[] = [];
  const sumar = (id: string | null | undefined, puesto: (typeof puestos)[number]["puesto"]) => {
    if (id && !puestos.some((p) => p.id === id)) puestos.push({ id, puesto });
  };
  sumar(clave.pmId, "pm");
  sumar(clave.directoraId, "direccion_creativa");
  // Todos los roles de coordinación (pedido del 12/10: sumar a Leo y a Guille).
  for (const u of users.filter((x) => tieneArea(x, "Coordinación General"))) sumar(u.id, "coord_general");
  for (const u of users.filter((x) => tieneArea(x, "Coordinación de Paid Media"))) sumar(u.id, "paid_media");
  for (const u of users.filter((x) => x.rol === "comercial" || x.rol === "prospecting")) sumar(u.id, "comercial");
  const cuentaJd = (internas ?? [])[0] as { id: string; cm_id: string | null } | undefined;
  const idsInternos = new Set(((internas ?? []) as { id: string }[]).map((c) => c.id));
  sumar(cuentaJd?.cm_id, "cuenta_jd");
  // Cualquier otra coordinación que aparezca, con lo común a todos.
  for (const u of users.filter(
    (x) => !direccion.has(x.id) && ((x.area ?? "").startsWith("Coordinación") || (x.area_secundaria ?? "").startsWith("Coordinación"))
  ))
    sumar(u.id, "coordinacion");
  // El dueño no se sigue a sí mismo.
  for (let i = puestos.length - 1; i >= 0; i--) if (direccion.has(puestos[i].id) && duenos.length) puestos.splice(i, 1);

  const elegidos = soloPersona ? puestos.filter((p) => p.id === soloPersona) : puestos;
  if (!elegidos.length) return { tarjetas: [], pedidos: {} };

  const vencida = (t: TareaAbierta) => !!t.fecha_limite && t.fecha_limite < hoy;
  const pedidos: Record<string, Pedido[]> = {};
  const comunesDe = (id: string): Comunes => {
    const mias = tareas.filter((t) => t.asignado_a_id === id);
    const pedidas = mias
      // Solo pedidos de verdad: las tareas que la app crea sola al dar de alta
      // un cliente también figuran como creadas por la dirección (21 de las 23
      // de Luz el 12/10). Un pedido no es de una cuenta, o es de JD Media.
      .filter(
        (t) =>
          t.creado_por_id &&
          direccion.has(t.creado_por_id) &&
          t.creado_por_id !== id &&
          !t.rutina_key &&
          (!t.cliente_id || idsInternos.has(t.cliente_id))
      )
      .sort((a, b) => (a.fecha_limite ?? "9999").localeCompare(b.fecha_limite ?? "9999"));
    pedidos[id] = pedidas.map((t) => ({
      id: t.id,
      numero: t.numero,
      titulo: t.titulo,
      fecha_limite: t.fecha_limite,
      vencido: vencida(t),
    }));
    return {
      tareasVencidas: mias.filter(vencida).length,
      pedidosAbiertos: pedidas.length,
      pedidosVencidos: pedidas.filter(vencida).length,
    };
  };

  const tarjetas: Tarjeta[] = [];
  for (const { id, puesto } of elegidos) {
    const persona = { id, nombre: nombre(id) };
    if (puesto === "pm") {
      const ayer = new Date(ahora.getTime() - 86_400_000).toISOString();
      const { filas } = await cargarPanoramaArranques(admin, hoy);
      const { cuentas } = await cargarCuentasNuevas(admin, hoy, { arranques: arranquesPorCuenta(filas) });
      const tablero = tableroCuentasNuevas(cuentas, hoy);
      tarjetas.push(
        tarjetaPm(
          persona,
          {
            vencidasEquipo: tareas.filter(vencida).length,
            sinRepartir: tareas.filter(
              (t) =>
                t.asignado_a_id === id &&
                t.creado_por_id !== id &&
                AREAS_DE_LA_PM.includes(t.area ?? "") &&
                (t.estado === "pendiente" || t.estado === "bloqueada") &&
                t.created_at < ayer
            ).length,
            cuentasEnRiesgo: tablero.filter((c) => c.estado === "mal").length,
            cuentasNuevas: tablero.length,
          },
          comunesDe(id)
        )
      );
    } else if (puesto === "direccion_creativa") {
      const en5 = new Date(ahora.getTime() + 5 * 86_400_000).toISOString();
      const [{ data: revision }, { count: ideas }] = await Promise.all([
        admin.from("tasks").select("revision_desde").eq("estado", "en_revision").eq("aprobador_id", id),
        admin
          .from("publications")
          .select("id", { count: "exact", head: true })
          .eq("estado", "idea")
          .gte("fecha_publicacion", ahora.toISOString())
          .lte("fecha_publicacion", en5),
      ]);
      const r = (revision ?? []) as { revision_desde: string | null }[];
      const wpp = await avanceServicio(admin, hoy, ["wpp", "chat"]);
      tarjetas.push(
        tarjetaDireccionCreativa(
          persona,
          {
            paraAprobar: r.length,
            fueraDeTiempo: r.filter((x) => x.revision_desde && estadoAprobacion(x.revision_desde, ahora).vencida).length,
            ideasUrgentes: ideas ?? 0,
            wpp,
          },
          comunesDe(id)
        )
      );
    } else if (puesto === "comercial") {
      const u = users.find((x) => x.id === id);
      const contactos = await todosLosContactos<ContactoActividad>(
        admin,
        "asignado_a, contactado_at, estado, reunion_at"
      );
      const fila = resumirActividad(contactos, [{ id, nombre: persona.nombre, email: u?.email, metaProspeccion: u?.meta_prospeccion }], hoy).filas[0];
      const mes = hoy.slice(0, 7);
      tarjetas.push(
        tarjetaComercial(
          persona,
          {
            hoy: fila?.hoy ?? 0,
            semana: fila?.semana ?? 0,
            metaDiaria: metaDe(u?.email, u?.meta_prospeccion),
            diasHabilesSemana: diasHabilesHastaHoy(hoy),
            reunionesMes: contactos.filter((c) => c.asignado_a === id && c.reunion_at?.startsWith(mes)).length,
          },
          comunesDe(id)
        )
      );
    } else if (puesto === "paid_media" || puesto === "coord_general" || puesto === "coordinacion") {
      const t = await tarjetaExtra(admin, persona, puesto, hoy, comunesDe(id));
      if (t) tarjetas.push(t);
    } else if (puesto === "cuenta_jd" && cuentaJd) {
      const inicioMes = `${hoy.slice(0, 7)}-01T03:00:00Z`;
      const hace30 = new Date(ahora.getTime() - 30 * 86_400_000).toISOString();
      const { data: pubs } = await admin
        .from("publications")
        .select("estado, fecha_publicacion")
        .eq("cliente_id", cuentaJd.id)
        .gte("fecha_publicacion", hace30 < inicioMes ? hace30 : inicioMes)
        .lte("fecha_publicacion", ahora.toISOString());
      const lista = (pubs ?? []) as { estado: string; fecha_publicacion: string }[];
      const delMes = lista.filter((p) => p.fecha_publicacion >= inicioMes && p.estado !== "rechazado");
      tarjetas.push(
        tarjetaCuentaJd(
          persona,
          {
            publicadas: delMes.filter((p) => p.estado === "publicado").length,
            previstasAHoy: delMes.length,
            atrasadas: lista.filter((p) => p.estado !== "publicado" && p.estado !== "rechazado").length,
            diaDelMes: Number(hoy.slice(8, 10)),
          },
          comunesDe(id)
        )
      );
    }
  }

  return { tarjetas: ordenarTarjetas(tarjetas), pedidos };
}

async function tarjetaExtra(
  admin: SupabaseClient,
  persona: { id: string; nombre: string },
  puesto: Puesto,
  hoy: string,
  comunes: Comunes
): Promise<Tarjeta | null> {
  if (puesto === "paid_media") {
    const hace7 = new Date(Date.now() - 7 * 86_400_000).toISOString().slice(0, 10);
    const { data: cs } = await admin
      .from("clients")
      .select("id")
      .eq("estado", "activo")
      .eq("es_interno", false)
      .not("media_buyer_id", "is", null);
    const ids = ((cs ?? []) as { id: string }[]).map((c) => c.id);
    const [{ data: snaps }, { data: onb }] = ids.length
      ? await Promise.all([
          admin.from("paid_media_snapshots").select("cliente_id").in("cliente_id", ids).gte("fecha", hace7),
          admin.from("client_ads_onboarding").select("cliente_id").in("cliente_id", ids).not("campanas_publicadas_at", "is", null),
        ])
      : [{ data: [] }, { data: [] }];
    const gads = await avanceServicio(admin, hoy, ["gads"]);
    return tarjetaPaidMedia(
      persona,
      {
        gads,
        conPauta: ids.length,
        conectadas: new Set(((snaps ?? []) as { cliente_id: string }[]).map((x) => x.cliente_id)).size,
        conCampanas: new Set(((onb ?? []) as { cliente_id: string }[]).map((x) => x.cliente_id)).size,
      },
      comunes
    );
  }
  if (puesto === "coord_general") {
    const { data: inv } = await admin
      .from("client_invoices")
      .select("cliente_id, monto, fecha_cobro")
      .eq("periodo", hoy.slice(0, 7));
    // Por cliente, no por factura: un cliente con 3 servicios tiene 3 facturas
    // y es UN cobro (12/10/2026).
    const lista = (inv ?? []) as { cliente_id: string; monto: number | string; fecha_cobro: string | null }[];
    const clientes = new Set(lista.map((x) => x.cliente_id));
    const pendientes = lista.filter((x) => !x.fecha_cobro);
    return tarjetaCoordGeneral(
      persona,
      {
        sinCobrar: new Set(pendientes.map((x) => x.cliente_id)).size,
        montoSinCobrar: pendientes.reduce((a, x) => a + Number(x.monto || 0), 0),
        total: clientes.size,
        diaDelMes: Number(hoy.slice(8, 10)),
      },
      comunes
    );
  }
  if (puesto === "coordinacion") return tarjetaGenerica(persona, comunes);
  return null;
}
