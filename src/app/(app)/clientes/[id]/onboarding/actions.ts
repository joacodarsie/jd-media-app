"use server";

import { esMarcaReal, MARCA_REAL, tiposDeServicio } from "@/lib/pack-marca-real";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { runOnboarding15 } from "@/lib/retencion/onboarding-15-run";
import { SERVICE_TYPE_LABEL } from "@/lib/constants";
import { AGENCY } from "@/lib/agency";
import { applyContractDiscount } from "@/lib/payment-reminder";
import { calcularPrimerMes } from "@/lib/finanzas/primer-mes";
import { COBRO_DESDE_DIA, VENTANA_COBRO_TEXTO } from "@/lib/finanzas/ciclo-cobro";
import { mensajesDeBienvenida } from "@/lib/onboarding/bienvenida";
import { anotarPaseDeCuenta, ROLES_CON_HISTORIAL } from "@/lib/payroll/asignaciones-run";

/** Lo que baja el abono de gestión de redes sin la gestión de pauta (igual que en el alta). */
const DESCUENTO_SIN_PAUTA = 50000;

type StepKey =
  | "carta_enviada_at"
  | "pago_recibido_at"
  | "equipo_asignado_at"
  | "grupo_wpp_creado_at"
  | "mensajes_enviados_at"
  | "diagnostico_generado_at"
  | "tareas_iniciales_at"
  | "kickoff_agendado_at"
  | "meet_guide_generated_at"
  | "drive_creado_at"
  | "accesos_cargados_at"
  | "perfiles_rediseno_at"
  | "cm_accesos_at"
  | "cm_perfiles_at"
  | "cm_vinculacion_at"
  | "dg_manual_marca_at"
  | "dg_kit_marca_at"
  | "dg_proyecto_canva_at"
  | "dg_plantillas_historias_at"
  | "dg_aprobado_at";

const VALID_STEPS: StepKey[] = [
  "carta_enviada_at",
  "pago_recibido_at",
  "equipo_asignado_at",
  "grupo_wpp_creado_at",
  "mensajes_enviados_at",
  "diagnostico_generado_at",
  "tareas_iniciales_at",
  "kickoff_agendado_at",
  "meet_guide_generated_at",
  "drive_creado_at",
  "accesos_cargados_at",
  "perfiles_rediseno_at",
  "cm_accesos_at",
  "cm_perfiles_at",
  "cm_vinculacion_at",
  "dg_manual_marca_at",
  "dg_kit_marca_at",
  "dg_proyecto_canva_at",
  "dg_plantillas_historias_at",
  "dg_aprobado_at",
];

export async function toggleOnboardingStep(
  clientId: string,
  step: StepKey,
  done: boolean
) {
  const me = await requireUser();
  if (!VALID_STEPS.includes(step)) return { error: "Paso inválido" };
  // La aprobación de la identidad visual la marca solo la Coordinación de Diseño
  // (o admin): es quien define el criterio estético del arranque de la cuenta.
  if (step === "dg_aprobado_at") {
    const ok =
      me.rol === "admin" ||
      me.rol === "coordinador_diseno" ||
      me.rol_secundario === "coordinador_diseno";
    if (!ok)
      return { error: "Solo la Coordinación de Diseño puede aprobar este paso." };
  }
  const admin = createAdmin();
  const value = done ? new Date().toISOString() : null;

  const { error } = await admin
    .from("client_onboarding")
    .upsert(
      { cliente_id: clientId, [step]: value },
      { onConflict: "cliente_id" }
    );
  if (error) return { error: error.message };

  revalidatePath(`/clientes/${clientId}/onboarding`);
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

/**
 * Asigna los puestos del cliente (CM, diseño, audiovisual) — y opcionalmente la
 * coordinadora. Lo puede hacer el admin, cualquier coordinador/a, o la
 * coordinadora asignada a ESTA cuenta. Pensado para que la coordinación del
 * servicio defina su equipo desde el onboarding de Gestión de Redes.
 */
export async function assignClientTeam(
  clientId: string,
  team: {
    cm_id: string | null;
    disenador_id: string | null;
    audiovisual_id: string | null;
    media_buyer_id?: string | null;
    coordinador_id?: string | null;
    /** Director creativo: es `responsable_id`, el que cobra su 5%. */
    responsable_id?: string | null;
    /** true = la gestión de redes NO incluye la pauta (−$50.000, sin gestor). */
    sinPauta?: boolean;
  }
) {
  const me = await requireUser();
  const admin = createAdmin();

  const { data: client } = await admin
    .from("clients")
    .select("coordinador_id, cm_id, media_buyer_id, responsable_id, fecha_inicio, monto_mensual")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { error: "Cliente no encontrado." };

  const esCoordinador =
    me.rol === "admin" ||
    me.rol === "coordinador" ||
    me.rol_secundario === "coordinador" ||
    me.id === (client as { coordinador_id: string | null }).coordinador_id;
  if (!esCoordinador) return { error: "No tenés permiso para asignar el equipo." };

  const patch: Record<string, string | null> = {
    cm_id: team.cm_id || null,
    disenador_id: team.disenador_id || null,
    audiovisual_id: team.audiovisual_id || null,
  };
  // El gestor de pauta solo se toca si vino en el input (el onboarding de redes
  // no lo manda, y no queremos borrarlo sin querer).
  if (team.media_buyer_id !== undefined) patch.media_buyer_id = team.media_buyer_id || null;
  // Solo admin/coordinación general puede cambiar la coordinadora de la cuenta.
  if (
    team.coordinador_id !== undefined &&
    (me.rol === "admin" || me.rol === "coordinador" || me.rol_secundario === "coordinador")
  ) {
    patch.coordinador_id = team.coordinador_id || null;
  }

  const puedeCoordinar =
    me.rol === "admin" || me.rol === "coordinador" || me.rol_secundario === "coordinador";
  // El director creativo cobra un % de la cuenta: lo cambia solo la coordinación.
  if (team.responsable_id !== undefined && puedeCoordinar) {
    patch.responsable_id = team.responsable_id || null;
  }
  // Sin pauta no hay gestor que pagar.
  if (team.sinPauta === true) patch.media_buyer_id = null;

  const previo = client as {
    cm_id: string | null;
    media_buyer_id: string | null;
    responsable_id: string | null;
    fecha_inicio: string | null;
    monto_mensual: number | null;
  };

  const { error } = await admin.from("clients").update(patch).eq("id", clientId);
  if (error) return { error: error.message };

  // Los puestos que se pagan por mes llevan historial: sin el pase fechado,
  // cambiar a alguien acá le reescribía los sueldos de los meses ya cerrados.
  for (const { rol, campo } of ROLES_CON_HISTORIAL) {
    const nuevo = patch[campo];
    if (nuevo === undefined) continue;
    const viejo = previo[campo as "cm_id" | "media_buyer_id" | "responsable_id"];
    if ((nuevo ?? null) === (viejo ?? null)) continue;
    await anotarPaseDeCuenta(admin, {
      clienteId: clientId,
      rol,
      nuevoUserId: nuevo ?? null,
      anteriorUserId: viejo,
      clienteDesde: previo.fecha_inicio,
      nota: "pase desde el equipo de la cuenta",
    });
  }

  // La pauta: se marca en la gestión de redes y el abono baja (o sube) $50.000,
  // como en el alta. Solo si de verdad cambia, para no descontar dos veces.
  if (team.sinPauta !== undefined && puedeCoordinar) {
    const { data: svcs } = await admin
      .from("client_services")
      .select("id, monto_mensual, media_buyer_aplica")
      .eq("cliente_id", clientId)
      .eq("tipo", "gestion_redes")
      .eq("activo", true);
    let delta = 0;
    for (const s of (svcs ?? []) as { id: string; monto_mensual: number | null; media_buyer_aplica: boolean | null }[]) {
      const incluia = s.media_buyer_aplica !== false;
      if (incluia === !team.sinPauta) continue;
      const cambio = team.sinPauta ? -DESCUENTO_SIN_PAUTA : DESCUENTO_SIN_PAUTA;
      const monto = s.monto_mensual == null ? null : Math.max(0, Number(s.monto_mensual) + cambio);
      await admin
        .from("client_services")
        .update({ media_buyer_aplica: !team.sinPauta, monto_mensual: monto })
        .eq("id", s.id);
      if (s.monto_mensual != null) delta += cambio;
    }
    if (delta !== 0 && previo.monto_mensual != null) {
      await admin
        .from("clients")
        .update({ monto_mensual: Math.max(0, Number(previo.monto_mensual) + delta) })
        .eq("id", clientId);
    }
  }

  revalidatePath(`/clientes/${clientId}/onboarding/redes`);
  revalidatePath(`/clientes/${clientId}/onboarding`);
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true as const };
}

/**
 * Registra el pago recibido del onboarding con el monto efectivo (puede ser una
 * seña parcial) y una nota opcional. Si el monto es > 0 marca el paso como
 * hecho (pago_recibido_at = ahora); si se limpia (monto null/0 y sin nota) lo
 * vuelve a pendiente.
 */
export async function setPagoRecibido(
  clientId: string,
  monto: number | null,
  nota: string | null
) {
  await requireUser();
  const admin = createAdmin();

  const montoClean =
    monto != null && Number.isFinite(monto) && monto > 0 ? monto : null;
  const notaClean = nota?.trim() ? nota.trim() : null;
  const recibido = montoClean != null || notaClean != null;

  const { error } = await admin.from("client_onboarding").upsert(
    {
      cliente_id: clientId,
      pago_recibido_monto: montoClean,
      pago_recibido_nota: notaClean,
      pago_recibido_at: recibido ? new Date().toISOString() : null,
    },
    { onConflict: "cliente_id" }
  );
  if (error) return { error: error.message };

  revalidatePath(`/clientes/${clientId}/onboarding`);
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

/**
 * Guarda el link del Drive del cliente (clients.drive_url) y, si hay link, marca
 * el paso "Drive creado" como hecho. El link se muestra en el calendario de
 * contenidos para abrir el Drive con un click.
 */
export async function setClientDriveUrl(clientId: string, url: string | null) {
  await requireUser();
  const admin = createAdmin();
  const clean = url?.trim() || null;

  const { error: cErr } = await admin
    .from("clients")
    .update({ drive_url: clean })
    .eq("id", clientId);
  if (cErr) return { error: cErr.message };

  const { error: oErr } = await admin.from("client_onboarding").upsert(
    {
      cliente_id: clientId,
      drive_creado_at: clean ? new Date().toISOString() : null,
    },
    { onConflict: "cliente_id" }
  );
  if (oErr) return { error: oErr.message };

  revalidatePath(`/clientes/${clientId}/onboarding`);
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true };
}

/**
 * Crea automáticamente la carpeta del cliente en el Drive de JD Media
 * (con sus 3 subcarpetas), la comparte por link y deja el paso marcado.
 * Si no hay una cuenta de Google con Drive conectada devuelve
 * `noConnection: true` para que la UI ofrezca conectarla.
 */
export async function autoCreateClientDrive(clientId: string) {
  await requireUser();
  const admin = createAdmin();

  const { data: client } = await admin
    .from("clients")
    .select("id, nombre, drive_url")
    .eq("id", clientId)
    .maybeSingle();
  if (!client) return { error: "Cliente no encontrado." };
  if ((client as { drive_url: string | null }).drive_url) {
    return {
      error:
        "Este cliente ya tiene un Drive cargado. Borrá el link y guardá antes de regenerarlo.",
    };
  }

  const { createClientDriveStructure } = await import("@/lib/google-drive");
  const res = await createClientDriveStructure(
    (client as { nombre: string }).nombre
  );
  if ("error" in res) return res;

  const { error: cErr } = await admin
    .from("clients")
    .update({ drive_url: res.url })
    .eq("id", clientId);
  if (cErr) return { error: cErr.message };

  const { error: oErr } = await admin.from("client_onboarding").upsert(
    { cliente_id: clientId, drive_creado_at: new Date().toISOString() },
    { onConflict: "cliente_id" }
  );
  if (oErr) return { error: oErr.message };

  revalidatePath(`/clientes/${clientId}/onboarding`);
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, url: res.url, email: res.email };
}

export async function assignContractNumber(clientId: string) {
  await requireUser();
  const admin = createAdmin();
  const year = new Date().getFullYear();
  const { data: seq, error: seqErr } = await admin.rpc("next_contract_number", {
    p_year: year,
  });
  if (seqErr) return { error: seqErr.message };
  const numero = `JD-${year}-${String(seq).padStart(4, "0")}`;
  const { error } = await admin
    .from("clients")
    .update({ contrato_numero: numero })
    .eq("id", clientId);
  if (error) return { error: error.message };
  revalidatePath(`/clientes/${clientId}/onboarding`);
  revalidatePath(`/clientes/${clientId}`);
  return { ok: true, numero };
}

/** Crea tareas iniciales según los servicios contratados del cliente. */
/**
 * Arma el onboarding de 15 días de la cuenta (ticket madre + desglose).
 *
 * Desde el 13/9/2026 el plan vive en `lib/retencion/onboarding-15.ts` y es el
 * MISMO que dispara la activación del cliente: antes había dos listas de tareas
 * de arranque distintas —una acá, plana y sin jerarquía— y ninguna seguía el
 * orden que dictó el dueño. Este botón quedó como reintento manual.
 */
export async function generateInitialTasks(clientId: string) {
  const me = await requireUser();
  const admin = createAdmin();

  const r = await runOnboarding15(admin, clientId, { creadoPorId: me.id });

  if (!r.creado) {
    if (r.motivo === "ya_existe")
      return { error: "Esta cuenta ya tiene su onboarding de 15 días armado." };
    if (r.motivo === "sin_cliente") return { error: "Cliente no encontrado." };
    if (r.motivo === "sin_responsable")
      return { error: "No hay a quién asignarle las tareas: falta la coordinación." };
    return { error: r.error ?? "No se pudo armar el onboarding." };
  }

  await admin
    .from("client_onboarding")
    .upsert(
      { cliente_id: clientId, tareas_iniciales_at: new Date().toISOString() },
      { onConflict: "cliente_id" }
    );

  revalidatePath(`/clientes/${clientId}/onboarding`);
  revalidatePath(`/clientes/${clientId}`);
  revalidatePath("/tareas");
  return { ok: true, count: r.subtareas ?? 0, numero: r.numero };
}

/** Devuelve los textos de bienvenida (cadena de mensajes) personalizados según servicios. */
export async function buildWelcomeMessages(clientId: string): Promise<
  { ok: true; messages: string[] } | { ok: false; error: string }
> {
  await requireUser();
  // Admin: los nombres del equipo viven en `users`, que RLS no deja leer entero.
  const admin = createAdmin();

  const [{ data: client }, { data: services }, { data: users }] = await Promise.all([
    admin
      .from("clients")
      .select("nombre, contacto_nombre, cm_id, disenador_id, audiovisual_id, media_buyer_id, coordinador_id")
      .eq("id", clientId)
      .maybeSingle(),
    admin
      .from("client_services")
      .select("tipo, pack, media_buyer_aplica, responsables, costo_override_user")
      .eq("cliente_id", clientId)
      .eq("activo", true),
    admin.from("users").select("id, nombre, rol, rol_secundario, area, area_secundaria").eq("activo", true),
  ]);
  if (!client) return { ok: false, error: "Cliente no encontrado" };

  const c = client as {
    nombre: string;
    contacto_nombre: string | null;
    cm_id: string | null;
    disenador_id: string | null;
    audiovisual_id: string | null;
    media_buyer_id: string | null;
    coordinador_id: string | null;
  };
  const svcs = (services ?? []) as {
    tipo: string;
    pack: string | null;
    media_buyer_aplica: boolean | null;
    responsables: string[] | null;
    costo_override_user: string | null;
  }[];
  const us = (users ?? []) as {
    id: string;
    nombre: string;
    rol: string;
    rol_secundario: string | null;
    area: string | null;
    area_secundaria: string | null;
  }[];
  const nombreDe = (id: string | null) => (id ? (us.find((u) => u.id === id)?.nombre ?? null) : null);
  const tieneRol = (u: { rol: string; rol_secundario: string | null }, r: string) =>
    u.rol === r || u.rol_secundario === r;

  // La project manager es la coordinadora de la cuenta; si no hay, quien tenga
  // el área de Coordinación. La dirección creativa, quien tenga coordinador_diseno
  // o el área de Coordinación de Diseño (desde el 22/9 es Santi, como área secundaria).
  const projectManager =
    nombreDe(c.coordinador_id) ?? us.find((u) => u.area === "Coordinación")?.nombre ?? null;
  const directoraCreativa =
    us.find((u) => tieneRol(u, "coordinador_diseno"))?.nombre ??
    us.find((u) => u.area === "Coordinación de Diseño" || u.area_secundaria === "Coordinación de Diseño")
      ?.nombre ??
    null;
  // Quien brinda el WhatsApp: el "Lo lleva" del servicio; si no hay, a quien se le paga.
  const svcWsp = svcs.filter((sv) => sv.tipo === "gestion_whatsapp" || sv.tipo === "chatter");
  const whatsapp =
    nombreDe(svcWsp.flatMap((sv) => sv.responsables ?? [])[0] ?? null) ??
    nombreDe(svcWsp.find((sv) => sv.costo_override_user)?.costo_override_user ?? null);
  const mediaBuyer =
    nombreDe(c.media_buyer_id) ?? us.find((u) => tieneRol(u, "paid_media"))?.nombre ?? null;
  const redes = svcs.find((sv) => sv.tipo === "gestion_redes");

  const messages = mensajesDeBienvenida({
    contacto: (c.contacto_nombre ?? c.nombre).split(" ")[0],
    marca: c.nombre,
    servicios: tiposDeServicio(svcs),
    conGestionDeCampanas: redes ? redes.media_buyer_aplica !== false : false,
    director: "Joaquín Darsie",
    equipo: {
      projectManager,
      directoraCreativa,
      communityManager: nombreDe(c.cm_id),
      disenador: nombreDe(c.disenador_id),
      editor: nombreDe(c.audiovisual_id),
      mediaBuyer,
      whatsapp,
    },
  });

  return { ok: true, messages };
}

/**
 * Genera el mensaje de cobro que se envía al cliente junto con la carta acuerdo.
 * Calcula automáticamente el proporcional si la fecha de inicio no es día 1.
 */
export async function buildPaymentMessage(clientId: string): Promise<
  | {
      ok: true;
      message: string;
      breakdown: {
        moneda: string;
        totalMensual: number;
        montoConDescuento: number | null;
        montoEsteMes: number;
        esProporcional: boolean;
        diasRestantes: number;
        diasMes: number;
        fechaInicio: string | null;
      };
    }
  | { ok: false; error: string }
> {
  await requireUser();
  const supabase = createClient();

  const { data: client } = await supabase
    .from("clients")
    .select(
      "nombre, contacto_nombre, contrato_fecha_inicio, contrato_descuento_pct, contrato_descuento_monto, contrato_descuento_meses, contrato_moneda"
    )
    .eq("id", clientId)
    .maybeSingle();

  if (!client) return { ok: false, error: "Cliente no encontrado" };

  const { data: services } = await supabase
    .from("client_services")
    .select("tipo, pack, monto_mensual, facturacion")
    .eq("cliente_id", clientId)
    .eq("activo", true);
  const svcs = (services ?? []) as {
    tipo: string;
    pack: string | null;
    monto_mensual: number | null;
    facturacion: string | null;
  }[];
  // Cobro único (Pack Marca Real, un diseño, una web): no es abono ni va
  // proporcional. Antes se sumaba al "monto mensual" y el mensaje salía mal.
  const mensuales = svcs.filter((s) => s.facturacion !== "unico");
  const unicos = svcs.filter((s) => s.facturacion === "unico");
  const totalUnico = unicos.reduce((a, s) => a + (Number(s.monto_mensual) || 0), 0);
  const unicoTodoAdelantado = unicos.length > 0 && unicos.every((s) => esMarcaReal(s));
  // Lo que se paga ahora del único: todo si es Marca Real, la mitad si no.
  const unicoAhora = unicoTodoAdelantado ? totalUnico : Math.round(totalUnico / 2);
  const hayRedes = svcs.some((s) => s.tipo === "gestion_redes");

  const c = client as {
    nombre: string;
    contacto_nombre: string | null;
    contrato_fecha_inicio: string | null;
    contrato_descuento_pct: number | null;
    contrato_descuento_monto: number | null;
    contrato_descuento_meses: number | null;
    contrato_moneda: string | null;
  };
  const moneda = c.contrato_moneda ?? "ARS";
  const totalMensual = mensuales.reduce((acc, s) => acc + (Number(s.monto_mensual) || 0), 0);

  const descPct = Number(c.contrato_descuento_pct) || 0;
  const descMonto = Number(c.contrato_descuento_monto) || 0;
  const descMeses = Number(c.contrato_descuento_meses) || 0;
  const hayDescuento = (descPct > 0 || descMonto > 0) && descMeses > 0;
  const montoEffective = hayDescuento
    ? applyContractDiscount(totalMensual, c)
    : totalMensual;

  // Política vigente (2026-09): el primer mes se cobra PROPORCIONAL a los días
  // que quedan desde el arranque. Además, las DOS primeras semanas no llevan
  // contenido publicado: son las de puesta en marcha (diagnóstico, manual de
  // marca, perfiles y destacadas, calendario aprobado), tal como figura en la
  // carta acuerdo. El abono NO se descuenta por eso: la preparación es el
  // entregable de ese tramo.
  //
  // Era una sola semana hasta el 13/9/2026; el equipo concluyó que no alcanzaba.
  const inicio = c.contrato_fecha_inicio
    ? new Date(c.contrato_fecha_inicio + "T00:00:00")
    : null;

  const { diasMes, diasRestantes, esProporcional, montoEsteMes } = calcularPrimerMes(
    montoEffective,
    c.contrato_fecha_inicio
  );

  function fmtMoney(n: number) {
    try {
      return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: moneda,
        maximumFractionDigits: 0,
      }).format(n);
    } catch {
      return `${moneda} ${n.toLocaleString("es-AR")}`;
    }
  }

  function fmtShort(iso: string) {
    const d = new Date(iso + "T00:00:00");
    return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  const nombre = (c.contacto_nombre ?? c.nombre).split(" ")[0];

  const lines: string[] = [];
  lines.push(`Listo ${nombre}, te envío la carta acuerdo junto con el alcance de los servicios contratados.`);
  lines.push("");

  if (mensuales.length > 0) {
    lines.push(`El monto mensual del servicio es de ${fmtMoney(montoEffective)}, como acordamos.`);
  }
  if (unicos.length > 0) {
    lines.push(
      unicoTodoAdelantado
        ? `El Pack Marca Real tiene un valor de ${fmtMoney(totalUnico)} y se abona el 100% por adelantado: con el pago reservamos tu cupo y arrancamos.`
        : `Los servicios de pago único suman ${fmtMoney(totalUnico)}: el 50% se abona para arrancar y el 50% contra la entrega de los archivos finales.`
    );
  }
  if (inicio && mensuales.length > 0) {
    lines.push(`Fecha de inicio: ${fmtShort(c.contrato_fecha_inicio!)}.`);
  }
  lines.push("");

  // Primer mes proporcional: se cobra solo lo que queda del mes desde el
  // arranque, con el cálculo a la vista para que no haya que explicarlo aparte.
  if (esProporcional && mensuales.length > 0) {
    lines.push(
      `Como arrancamos el ${fmtShort(c.contrato_fecha_inicio!)}, este primer mes se cobra proporcional a los días que quedan: ${fmtMoney(montoEsteMes)} (${diasRestantes} de ${diasMes} días). A partir del mes que viene se factura el monto mensual completo.`
    );
    lines.push("");
  }

  if (hayRedes) {
    lines.push(
      `Te cuento cómo arrancamos: las dos primeras semanas no publicamos contenido, las usamos para dejar todo en orden — diagnóstico de la cuenta, manual de marca, rediseño de perfiles y destacadas, y el calendario del mes para que lo apruebes. Es lo que hace que todo lo que salga después tenga sentido, y lo vas a ir viendo a medida que avanza.`
    );
  } else if (unicoTodoAdelantado) {
    lines.push(
      `Te cuento cómo arrancamos: te mando el brief de marca, 10 preguntas cortas. Desde que lo completás, en ${MARCA_REAL.diasHabilesEntrega} días hábiles tenés el logo, la identidad, las plantillas, el perfil de Instagram armado, el calendario y el manual de 30 ideas.`
    );
  }

  if (hayDescuento) {
    const descTxt = descMonto > 0 ? `de ${fmtMoney(descMonto)}` : `del ${descPct}%`;
    lines.push("");
    lines.push(
      `📌 Recordá que durante los primeros ${descMeses} ${descMeses === 1 ? "mes" : "meses"} aplica el descuento promocional ${descTxt}. Luego se factura el monto pleno.`
    );
  }

  if (mensuales.length > 0) {
    lines.push("");
    lines.push(
      `De acá en adelante el abono se cobra por adelantado, ${VENTANA_COBRO_TEXTO}. Te voy a estar mandando el recordatorio el ${COBRO_DESDE_DIA} de cada mes.`
    );
  }
  lines.push("");
  const aTransferir = (mensuales.length > 0 ? montoEsteMes : 0) + unicoAhora;
  lines.push(`👉 Total a transferir ahora: ${fmtMoney(aTransferir)}`);
  lines.push("");
  lines.push("Datos para transferencia:");
  lines.push(`Banco: ${AGENCY.bank.nombre}`);
  lines.push(`Alias: ${AGENCY.bank.alias}`);
  lines.push(`CVU: ${AGENCY.bank.cvu}`);
  lines.push(`Nombre: ${AGENCY.bank.titular}`);
  lines.push(`CUIL: ${AGENCY.bank.cuil}`);
  lines.push("");
  lines.push("Una vez realizado el pago, el servicio queda vigente y arrancamos 🚀");
  lines.push(`Cualquier duda comentame ${nombre}!`);

  return {
    ok: true,
    message: lines.join("\n"),
    breakdown: {
      moneda,
      totalMensual,
      montoConDescuento: hayDescuento ? montoEffective : null,
      montoEsteMes: aTransferir,
      esProporcional: esProporcional && mensuales.length > 0,
      diasRestantes,
      diasMes,
      fechaInicio: c.contrato_fecha_inicio,
    },
  };
}

void SERVICE_TYPE_LABEL; // mantener import por si lo usamos más adelante
