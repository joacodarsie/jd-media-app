"use server";

import { hoyYmd } from "@/lib/dates";

import { revalidatePath } from "next/cache";
import { requireFeature } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";

/**
 * Acciones de la pantalla simple de cobros.
 *
 * Clave del diseño: la factura NO tiene que existir de antes. Si el cliente es
 * activo y tiene abono, la fila aparece igual y se crea recién cuando el dueño
 * toca algo. Antes había que "generar las facturas del mes" primero, y por eso
 * nunca se registraba un cobro: julio cerró con 15 facturas y 0 cobradas.
 */

function invalidate() {
  revalidatePath("/cobros");
  revalidatePath("/finanzas");
  revalidatePath("/finanzas/mes");
  revalidatePath("/finanzas/cobros");
}

async function ctx() {
  const me = await requireFeature("finanzas");
  return { admin: createAdmin(), userId: me.id };
}

/** Busca la factura del cliente en el período, o la crea con el abono. */
async function asegurarFactura(
  admin: ReturnType<typeof createAdmin>,
  input: { clienteId: string; periodo: string; monto: number; concepto: string; userId: string }
): Promise<{ id: string } | { error: string }> {
  const { data: existente } = await admin
    .from("client_invoices")
    .select("id")
    .eq("cliente_id", input.clienteId)
    .eq("periodo", input.periodo)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (existente) return { id: (existente as { id: string }).id };

  const { data, error } = await admin
    .from("client_invoices")
    .insert({
      cliente_id: input.clienteId,
      periodo: input.periodo,
      concepto: input.concepto.slice(0, 200),
      monto: input.monto,
      moneda: "ARS",
      creado_por_id: input.userId,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  return { id: data.id as string };
}

/** "Me pagó": sella la fecha de cobro de hoy (creando la factura si no estaba). */
export async function marcarCobrado(input: {
  clienteId: string;
  periodo: string;
  monto: number;
  concepto?: string;
  fecha?: string;
}) {
  const { admin, userId } = await ctx();
  const res = await asegurarFactura(admin, {
    clienteId: input.clienteId,
    periodo: input.periodo,
    monto: input.monto,
    concepto: input.concepto || `Abono ${input.periodo}`,
    userId,
  });
  if ("error" in res) return { error: res.error };

  const hoy = input.fecha ?? hoyYmd();
  const { error } = await admin
    .from("client_invoices")
    .update({ fecha_cobro: hoy, monto: input.monto })
    .eq("id", res.id);
  if (error) return { error: error.message };

  // Si la cuenta estaba ESPERANDO EL PAGO, el pago la convierte en cliente.
  // Es el único momento en que alguien pasa a contar como cliente de verdad.
  const { data: cli } = await admin
    .from("clients")
    .select("estado")
    .eq("id", input.clienteId)
    .maybeSingle();
  let activado = false;
  if ((cli as { estado?: string } | null)?.estado === "esperando_pago") {
    const { error: upErr } = await admin
      .from("clients")
      .update({ estado: "activo", fecha_activado: new Date().toISOString() })
      .eq("id", input.clienteId);
    activado = !upErr;
  }

  invalidate();
  revalidatePath("/clientes");
  return { ok: true as const, activado };
}

/** Deshace el cobro (se marcó sin querer). */
export async function desmarcarCobrado(clienteId: string, periodo: string) {
  const { admin } = await ctx();
  const { error } = await admin
    .from("client_invoices")
    .update({ fecha_cobro: null })
    .eq("cliente_id", clienteId)
    .eq("periodo", periodo);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true as const };
}

/**
 * Cambia el monto del mes. Con `permanente`, además sube el abono: es un
 * aumento, no una excepción de este mes.
 *
 * Existe porque aplicar un aumento era "un viaje" — había que entrar a la ficha
 * del cliente, encontrar el servicio y editarlo ahí, y el abono del header
 * quedaba desincronizado igual. Ahora se hace desde la fila donde ya estás
 * mirando cuánto te tiene que pagar.
 */
export async function guardarMonto(input: {
  clienteId: string;
  periodo: string;
  monto: number;
  concepto?: string;
  /** true = de ahora en más (aumento). false/undefined = solo este mes. */
  permanente?: boolean;
}) {
  const { admin, userId } = await ctx();
  const res = await asegurarFactura(admin, {
    clienteId: input.clienteId,
    periodo: input.periodo,
    monto: input.monto,
    concepto: input.concepto || `Abono ${input.periodo}`,
    userId,
  });
  if ("error" in res) return { error: res.error };
  const { error } = await admin
    .from("client_invoices")
    .update({ monto: input.monto })
    .eq("id", res.id);
  if (error) return { error: error.message };

  let aviso: string | null = null;
  if (input.permanente) {
    // El abono vive en DOS lugares: `clients.monto_mensual` (lo que se ve en
    // listas y en Cobros cuando todavía no hay factura) y el servicio. Si se
    // toca uno solo, los números dejan de cerrar, así que se tocan los dos.
    await admin
      .from("clients")
      .update({ monto_mensual: input.monto })
      .eq("id", input.clienteId);

    const { data: svRaw } = await admin
      .from("client_services")
      .select("id, facturacion")
      .eq("cliente_id", input.clienteId)
      .eq("activo", true);
    const mensuales = ((svRaw ?? []) as { id: string; facturacion: string | null }[]).filter(
      (sv) => (sv.facturacion ?? "mensual") === "mensual"
    );
    if (mensuales.length === 1) {
      await admin
        .from("client_services")
        .update({ monto_mensual: input.monto })
        .eq("id", mensuales[0].id);
    } else if (mensuales.length > 1) {
      // Con varios servicios no hay forma de saber cuál subió: se actualiza el
      // total del cliente y se avisa, en vez de repartir a ciegas.
      aviso = "El cliente tiene varios servicios mensuales: revisá el detalle en su ficha.";
    }
    revalidatePath("/clientes");
    revalidatePath(`/clientes/${input.clienteId}`);
  }

  invalidate();
  return { ok: true as const, aviso };
}

/** La anotación que hoy vive en la cabeza: "me paga el 10", "pagó la mitad". */
export async function guardarNota(input: {
  clienteId: string;
  periodo: string;
  nota: string;
  monto: number;
}) {
  const { admin, userId } = await ctx();
  const res = await asegurarFactura(admin, {
    clienteId: input.clienteId,
    periodo: input.periodo,
    monto: input.monto,
    concepto: `Abono ${input.periodo}`,
    userId,
  });
  if ("error" in res) return { error: res.error };
  const { error } = await admin
    .from("client_invoices")
    .update({ notas: input.nota.trim().slice(0, 500) || null })
    .eq("id", res.id);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true as const };
}

// ── Seguimiento del cobro (etapa + entregas parciales) ─────────────────────
// Ver `lib/finanzas/cobro-gestion.ts` para el porqué: el cobro no es binario,
// y lo que pasa en el medio (le escribí / prometió / me dio una parte) es
// justo donde se pierde la plata.

/** En qué punto de la conversación está el cobro de ese cliente. */
export async function guardarEtapaCobro(input: {
  clienteId: string;
  periodo: string;
  etapa: string;
  monto: number;
  concepto: string;
}) {
  const { admin, userId } = await ctx();
  const f = await asegurarFactura(admin, { ...input, userId });
  if ("error" in f) return { error: f.error };

  const { error } = await admin
    .from("client_invoices")
    .update({ gestion_estado: input.etapa, gestion_at: new Date().toISOString() })
    .eq("id", f.id);
  if (error) {
    return {
      error:
        error.code === "42703"
          ? "Falta aplicar la migración 0155 en Supabase."
          : error.message,
    };
  }
  invalidate();
  return { ok: true as const };
}

/**
 * Registra una entrega a cuenta. Si con esta entrega se cubre el total, la
 * factura queda cobrada sola: nadie tiene que acordarse de marcarla después.
 */
export async function registrarPagoParcial(input: {
  clienteId: string;
  periodo: string;
  monto: number;
  concepto: string;
  montoEntregado: number;
  fecha?: string;
  nota?: string;
}) {
  const { admin, userId } = await ctx();
  if (!(input.montoEntregado > 0)) return { error: "El monto entregado tiene que ser mayor a cero." };

  const f = await asegurarFactura(admin, { ...input, userId });
  if ("error" in f) return { error: f.error };

  const { error } = await admin.from("invoice_payments").insert({
    invoice_id: f.id,
    monto: input.montoEntregado,
    fecha: input.fecha || hoyYmd(),
    nota: input.nota?.trim().slice(0, 300) || null,
    creado_por_id: userId,
  });
  if (error) {
    return {
      error:
        error.code === "42P01"
          ? "Falta aplicar la migración 0155 en Supabase."
          : error.message,
    };
  }

  // ¿Con esto quedó saldado?
  const [{ data: pagos }, { data: inv }] = await Promise.all([
    admin.from("invoice_payments").select("monto").eq("invoice_id", f.id),
    admin.from("client_invoices").select("monto, fecha_cobro").eq("id", f.id).maybeSingle(),
  ]);
  const entregado = ((pagos ?? []) as { monto: number }[]).reduce((a, p) => a + Number(p.monto), 0);
  const total = Number((inv as { monto: number } | null)?.monto ?? input.monto);
  const yaCobrada = !!(inv as { fecha_cobro: string | null } | null)?.fecha_cobro;

  if (!yaCobrada && total > 0 && entregado >= total) {
    await admin
      .from("client_invoices")
      .update({ fecha_cobro: input.fecha || hoyYmd(), gestion_estado: "cobrado" })
      .eq("id", f.id);
  } else {
    await admin.from("client_invoices").update({ gestion_estado: "parcial" }).eq("id", f.id);
  }

  invalidate();
  return { ok: true as const, entregado, saldado: entregado >= total };
}

/** Borra una entrega mal cargada (y destraba el "cobrado" si ya no da). */
export async function borrarPagoParcial(pagoId: string) {
  const { admin } = await ctx();
  const { data: pago } = await admin
    .from("invoice_payments")
    .select("invoice_id")
    .eq("id", pagoId)
    .maybeSingle();
  if (!pago) return { error: "No encontré esa entrega." };
  const invoiceId = (pago as { invoice_id: string }).invoice_id;

  const { error } = await admin.from("invoice_payments").delete().eq("id", pagoId);
  if (error) return { error: error.message };

  const [{ data: pagos }, { data: inv }] = await Promise.all([
    admin.from("invoice_payments").select("monto").eq("invoice_id", invoiceId),
    admin.from("client_invoices").select("monto").eq("id", invoiceId).maybeSingle(),
  ]);
  const entregado = ((pagos ?? []) as { monto: number }[]).reduce((a, p) => a + Number(p.monto), 0);
  const total = Number((inv as { monto: number } | null)?.monto ?? 0);
  if (total > 0 && entregado < total) {
    await admin
      .from("client_invoices")
      .update({ fecha_cobro: null, gestion_estado: entregado > 0 ? "parcial" : "pendiente" })
      .eq("id", invoiceId);
  }
  invalidate();
  return { ok: true as const };
}

// ── Lo que faltaba para que el mes se cierre de una sentada ────────────────
// El dueño no marca cobro por cobro: llega a fin de mes y sabe "me pagaron
// casi todos, quedan dos". Doce clics con un refresh cada uno es justamente
// por qué nunca lo hacía. Acá se tilda y se marca todo junto.

/** Marca varios cobros de un saque, con una sola fecha. */
export async function marcarCobradosEnLote(input: {
  periodo: string;
  fecha?: string;
  items: { clienteId: string; monto: number }[];
}) {
  const { admin, userId } = await ctx();
  if (!input.items.length) return { error: "No tildaste a nadie." };

  const fecha = input.fecha || hoyYmd();
  const errores: string[] = [];
  let activados = 0;

  for (const it of input.items) {
    const res = await asegurarFactura(admin, {
      clienteId: it.clienteId,
      periodo: input.periodo,
      monto: it.monto,
      concepto: `Abono ${input.periodo}`,
      userId,
    });
    if ("error" in res) {
      errores.push(res.error);
      continue;
    }
    const { error } = await admin
      .from("client_invoices")
      .update({ fecha_cobro: fecha, monto: it.monto, gestion_estado: "cobrado" })
      .eq("id", res.id);
    if (error) {
      errores.push(error.message);
      continue;
    }
    const { data: cli } = await admin
      .from("clients")
      .select("estado")
      .eq("id", it.clienteId)
      .maybeSingle();
    if ((cli as { estado?: string } | null)?.estado === "esperando_pago") {
      const { error: upErr } = await admin
        .from("clients")
        .update({ estado: "activo", fecha_activado: new Date().toISOString() })
        .eq("id", it.clienteId);
      if (!upErr) activados++;
    }
  }

  invalidate();
  revalidatePath("/clientes");
  if (errores.length) return { error: errores[0], marcados: input.items.length - errores.length };
  return { ok: true as const, marcados: input.items.length, activados };
}

/**
 * Sella una factura colgada (otro mes, o una cuenta que ya no está) sin tener
 * que ir al mes de esa factura a buscarla.
 */
export async function marcarFacturaCobrada(facturaId: string, fecha?: string) {
  const { admin } = await ctx();
  const { error } = await admin
    .from("client_invoices")
    .update({ fecha_cobro: fecha || hoyYmd(), gestion_estado: "cobrado" })
    .eq("id", facturaId);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true as const };
}

/**
 * Borra una factura que nunca debió existir: se emitió a una cuenta que se fue,
 * o a una propuesta que nunca pagó. Mientras queden colgadas, "lo que me deben"
 * es un número que nadie se cree.
 *
 * Solo se puede borrar lo que NO está cobrado ni tiene entregas a cuenta: si
 * entró plata, es un cobro real y se corrige, no se borra.
 */
export async function borrarFactura(facturaId: string) {
  const { admin } = await ctx();
  const { data: inv } = await admin
    .from("client_invoices")
    .select("fecha_cobro")
    .eq("id", facturaId)
    .maybeSingle();
  if (!inv) return { error: "No encontré esa factura." };
  if ((inv as { fecha_cobro: string | null }).fecha_cobro) {
    return { error: "Esa factura figura cobrada. Deshacé el cobro antes de borrarla." };
  }
  const { data: pagos } = await admin
    .from("invoice_payments")
    .select("id")
    .eq("invoice_id", facturaId)
    .limit(1);
  if ((pagos ?? []).length > 0) {
    return { error: "Esa factura tiene entregas a cuenta cargadas. Borralas primero." };
  }

  const { error } = await admin.from("client_invoices").delete().eq("id", facturaId);
  if (error) return { error: error.message };
  invalidate();
  return { ok: true as const };
}
