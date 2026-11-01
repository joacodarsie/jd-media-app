/**
 * La parte de la conciliación con la planilla que toca la base (ver
 * conciliar.ts para las reglas). Lo usan la ruta que llama el script de la
 * planilla y la pantalla donde el dueño confirma o deshace.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  clientesDelDetalle,
  esJornada,
  mensajeCobro,
  mesDe,
  nombreMes,
  periodoDeSueldo,
  personaDelDetalle,
  planificarCobro,
  tipoDe,
  type DeudaMes,
  type MovimientoPlanilla,
} from "./conciliar";

const METODO = "Transferencia (detectada por la planilla)";

export type EstadoMovimiento = "marcado" | "sin_match" | "omitido" | "confirmado" | "deshecho";

export interface ResultadoMovimiento {
  clave: string;
  estado: EstadoMovimiento | "ignorado";
  mensaje: string;
  /** false si ya había llegado antes: no se vuelve a avisar. */
  nuevo: boolean;
}

interface EfectoCobro {
  facturasCobradas: string[];
  facturasCreadas: string[];
  pagosParciales: string[];
  clientesActivados: string[];
}

interface EfectoSueldo {
  pagoId: string;
  previo: { monto: number; fecha_pago: string | null; metodo_pago: string | null } | null;
}

const pesos = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;

async function aplicarCobro(
  db: SupabaseClient,
  m: MovimientoPlanilla,
): Promise<{ estado: EstadoMovimiento; mensaje: string; efecto?: EfectoCobro }> {
  if (esJornada(m)) return { estado: "omitido", mensaje: "Jornada de producción: no toca el abono." };

  const { data: cli } = await db.from("clients").select("id, nombre, estado, monto_mensual");
  // Todos, perdidos incluidos: un cliente que se fue puede pagar lo que debía (Power).
  const clientes = (cli ?? []) as { id: string; nombre: string; estado: string; monto_mensual: number | null }[];
  const elegidos = clientesDelDetalle(m.detalle, clientes);
  if (!elegidos.length) {
    return { estado: "sin_match", mensaje: `No encontré a qué cliente corresponde «${m.detalle || m.descripcion || "sin detalle"}».` };
  }

  const ids = elegidos.map((c) => c.id);
  const mes = mesDe(m.fecha);
  const { data: facts } = await db
    .from("client_invoices")
    .select("id, cliente_id, periodo, monto, fecha_cobro")
    .in("cliente_id", ids)
    .lte("periodo", mes);
  const facturas = ((facts ?? []) as { id: string; cliente_id: string; periodo: string; monto: number; fecha_cobro: string | null }[]).map(
    (f) => ({ ...f, monto: Number(f.monto) || 0 }),
  );
  const impagas = facturas.filter((f) => !f.fecha_cobro);
  const { data: entregas } = impagas.length
    ? await db.from("invoice_payments").select("invoice_id, monto").in("invoice_id", impagas.map((f) => f.id))
    : { data: [] };
  const entregado = new Map<string, number>();
  for (const e of (entregas ?? []) as { invoice_id: string; monto: number }[]) {
    entregado.set(e.invoice_id, (entregado.get(e.invoice_id) ?? 0) + (Number(e.monto) || 0));
  }

  // Lo que debe cada cliente, mes por mes.
  const deudas = new Map<string, DeudaMes>();
  for (const f of impagas) {
    const c = elegidos.find((x) => x.id === f.cliente_id)!;
    const k = `${f.cliente_id}|${f.periodo}`;
    const d = deudas.get(k) ?? { clienteId: c.id, cliente: c.nombre, periodo: f.periodo, saldo: 0 };
    d.saldo += f.monto - (entregado.get(f.id) ?? 0);
    deudas.set(k, d);
  }
  // El mes del cobro sin factura todavía: se cobra el abono y la factura se crea.
  for (const c of elegidos) {
    const tieneMes = facturas.some((f) => f.cliente_id === c.id && f.periodo === mes);
    if (!tieneMes && ["activo", "esperando_pago"].includes(c.estado) && (Number(c.monto_mensual) || 0) > 0) {
      deudas.set(`${c.id}|${mes}`, { clienteId: c.id, cliente: c.nombre, periodo: mes, saldo: Number(c.monto_mensual), sinFactura: true });
    }
  }

  const { acciones, sobrante } = planificarCobro([...deudas.values()], m.monto);
  if (!acciones.length) {
    return {
      estado: "sin_match",
      mensaje: `${elegidos.map((c) => c.nombre).join(" + ")} no tiene nada pendiente: ¿pagó por adelantado o es otra cosa?`,
    };
  }

  const efecto: EfectoCobro = { facturasCobradas: [], facturasCreadas: [], pagosParciales: [], clientesActivados: [] };
  for (const a of acciones) {
    let principal: string | null = null;
    if (a.sinFactura) {
      const { data, error } = await db
        .from("client_invoices")
        .insert({ cliente_id: a.clienteId, periodo: a.periodo, concepto: `Abono ${a.periodo}`, monto: deudas.get(`${a.clienteId}|${a.periodo}`)!.saldo, moneda: "ARS" })
        .select("id")
        .single();
      if (error || !data) return { estado: "sin_match", mensaje: `No pude crear la factura de ${a.cliente}: ${error?.message ?? "error"}` };
      principal = data.id as string;
      efecto.facturasCreadas.push(principal);
    }
    const delMes = impagas
      .filter((f) => f.cliente_id === a.clienteId && f.periodo === a.periodo)
      .sort((x, y) => y.monto - x.monto);
    const idsMes = [...(principal ? [principal] : []), ...delMes.map((f) => f.id)];

    if (a.tipo === "cobrado") {
      await db
        .from("client_invoices")
        .update({ fecha_cobro: m.fecha, gestion_estado: "cobrado", metodo_pago: METODO })
        .in("id", idsMes);
      efecto.facturasCobradas.push(...idsMes);
    } else {
      const { data: pago } = await db
        .from("invoice_payments")
        .insert({ invoice_id: idsMes[0], monto: a.monto, fecha: m.fecha, medio: "transferencia", nota: "Detectado por la planilla" })
        .select("id")
        .single();
      if (pago) efecto.pagosParciales.push(pago.id as string);
      await db.from("client_invoices").update({ gestion_estado: "parcial" }).eq("id", idsMes[0]);
    }
  }

  // Como en "¿Quién me pagó?": el primer pago convierte la cuenta en cliente.
  for (const c of elegidos.filter((x) => x.estado === "esperando_pago")) {
    const { error } = await db.from("clients").update({ estado: "activo", fecha_activado: new Date().toISOString() }).eq("id", c.id);
    if (!error) efecto.clientesActivados.push(c.id);
  }

  return { estado: "marcado", mensaje: mensajeCobro(acciones, sobrante), efecto };
}

async function aplicarSueldo(
  db: SupabaseClient,
  m: MovimientoPlanilla,
): Promise<{ estado: EstadoMovimiento; mensaje: string; efecto?: EfectoSueldo; userId?: string; periodo?: string }> {
  const { data: us } = await db.from("users").select("id, nombre").eq("activo", true);
  const persona = personaDelDetalle(m.detalle, (us ?? []) as { id: string; nombre: string }[]);
  if (!persona) {
    return { estado: "sin_match", mensaje: `No encontré a quién del equipo corresponde «${m.detalle || m.descripcion || "sin detalle"}».` };
  }
  const periodo = periodoDeSueldo(m.fecha);
  const concepto = `Sueldo ${periodo}`;

  // Si en el mes hubo más de una transferencia a la misma persona, se suman.
  const { data: anteriores } = await db
    .from("movimientos_planilla")
    .select("monto")
    .eq("tipo", "sueldo")
    .eq("user_id", persona.id)
    .eq("periodo", periodo)
    .in("estado", ["marcado", "confirmado"]);
  const suma = ((anteriores ?? []) as { monto: number }[]).reduce((a, x) => a + Number(x.monto), 0) + m.monto;

  const { data: previo } = await db
    .from("team_payments")
    .select("id, monto, fecha_pago, metodo_pago")
    .eq("user_id", persona.id)
    .eq("periodo", periodo)
    .eq("concepto", concepto)
    .maybeSingle();

  let pagoId: string;
  if (previo) {
    const p = previo as { id: string; monto: number; fecha_pago: string | null; metodo_pago: string | null };
    const { error } = await db.from("team_payments").update({ monto: suma, fecha_pago: m.fecha, metodo_pago: METODO }).eq("id", p.id);
    if (error) return { estado: "sin_match", mensaje: `No pude marcar el pago de ${persona.nombre}: ${error.message}` };
    pagoId = p.id;
  } else {
    const { data, error } = await db
      .from("team_payments")
      .insert({ user_id: persona.id, periodo, concepto, monto: suma, moneda: "ARS", fecha_programada: m.fecha, fecha_pago: m.fecha, metodo_pago: METODO })
      .select("id")
      .single();
    if (error || !data) return { estado: "sin_match", mensaje: `No pude registrar el pago de ${persona.nombre}: ${error?.message ?? "error"}` };
    pagoId = data.id as string;
  }

  const p = previo as { monto: number; fecha_pago: string | null; metodo_pago: string | null } | null;
  return {
    estado: "marcado",
    mensaje: `Sueldo de ${nombreMes(periodo)} de ${persona.nombre} pagado (${pesos(suma)})`,
    efecto: { pagoId, previo: p ? { monto: Number(p.monto), fecha_pago: p.fecha_pago, metodo_pago: p.metodo_pago } : null },
    userId: persona.id,
    periodo,
  };
}

/** Aplica los movimientos que manda la planilla. Los que ya llegaron antes devuelven lo mismo que la primera vez. */
export async function aplicarMovimientos(db: SupabaseClient, movs: MovimientoPlanilla[]): Promise<ResultadoMovimiento[]> {
  const out: ResultadoMovimiento[] = [];
  for (const m of movs) {
    const tipo = tipoDe(m.categoria);
    if (!tipo || !(m.monto > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(m.fecha) || !m.clave) {
      out.push({ clave: m.clave, estado: "ignorado", mensaje: "No es un cobro ni un sueldo.", nuevo: false });
      continue;
    }
    const { data: ya } = await db.from("movimientos_planilla").select("estado, mensaje").eq("clave", m.clave).maybeSingle();
    if (ya) {
      const y = ya as { estado: EstadoMovimiento; mensaje: string | null };
      out.push({ clave: m.clave, estado: y.estado, mensaje: y.mensaje ?? "", nuevo: false });
      continue;
    }

    const r = tipo === "cobro" ? await aplicarCobro(db, m) : await aplicarSueldo(db, m);
    await db.from("movimientos_planilla").insert({
      clave: m.clave,
      fecha: m.fecha,
      monto: m.monto,
      tipo,
      detalle: m.detalle?.slice(0, 300) || null,
      descripcion: m.descripcion?.slice(0, 300) || null,
      cuenta: m.cuenta?.slice(0, 80) || null,
      estado: r.estado,
      mensaje: r.mensaje,
      efecto: r.efecto ?? null,
      user_id: "userId" in r ? r.userId ?? null : null,
      periodo: "periodo" in r ? r.periodo ?? null : null,
    });
    out.push({ clave: m.clave, estado: r.estado, mensaje: r.mensaje, nuevo: true });
  }
  return out;
}

/** "No era esto": vuelve atrás lo que la app había marcado. */
export async function deshacerMovimiento(db: SupabaseClient, clave: string, quienId: string): Promise<{ error?: string }> {
  const { data } = await db.from("movimientos_planilla").select("tipo, estado, efecto").eq("clave", clave).maybeSingle();
  if (!data) return { error: "No encontré ese movimiento." };
  const row = data as { tipo: "cobro" | "sueldo"; estado: EstadoMovimiento; efecto: EfectoCobro | EfectoSueldo | null };
  if (row.estado !== "marcado" && row.estado !== "confirmado") return { error: "Ese movimiento no cambió nada en la app." };

  if (row.tipo === "cobro" && row.efecto) {
    const e = row.efecto as EfectoCobro;
    if (e.pagosParciales?.length) await db.from("invoice_payments").delete().in("id", e.pagosParciales);
    const cobradas = (e.facturasCobradas ?? []).filter((id) => !(e.facturasCreadas ?? []).includes(id));
    if (cobradas.length) {
      await db.from("client_invoices").update({ fecha_cobro: null, gestion_estado: null, metodo_pago: null }).in("id", cobradas);
    }
    if (e.facturasCreadas?.length) await db.from("client_invoices").delete().in("id", e.facturasCreadas);
    if (e.clientesActivados?.length) {
      await db.from("clients").update({ estado: "esperando_pago" }).in("id", e.clientesActivados);
    }
  }
  if (row.tipo === "sueldo" && row.efecto) {
    const e = row.efecto as EfectoSueldo;
    if (e.previo) {
      await db.from("team_payments").update(e.previo).eq("id", e.pagoId);
    } else {
      await db.from("team_payments").delete().eq("id", e.pagoId);
    }
  }

  await db
    .from("movimientos_planilla")
    .update({ estado: "deshecho", revisado_at: new Date().toISOString(), revisado_por_id: quienId })
    .eq("clave", clave);
  return {};
}

/** "Sí, estaba bien" (o, si no había nada que marcar, "ya lo resolví"). */
export async function confirmarMovimiento(db: SupabaseClient, clave: string, quienId: string): Promise<{ error?: string }> {
  const { error } = await db
    .from("movimientos_planilla")
    .update({ estado: "confirmado", revisado_at: new Date().toISOString(), revisado_por_id: quienId })
    .eq("clave", clave)
    .in("estado", ["marcado", "sin_match", "omitido"]);
  return error ? { error: error.message } : {};
}
