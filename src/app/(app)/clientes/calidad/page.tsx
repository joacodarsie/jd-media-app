import Link from "next/link";
import { ArrowLeft, HeartHandshake } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { currentPeriod, periodLabel } from "@/lib/finanzas";
import { StatCard } from "@/components/ui/stat-card";
import { QualityMonthTable, type QualityRow } from "@/components/quality-month-table";

export const dynamic = "force-dynamic";

/**
 * La ronda de calidad del mes: a qué cuentas les falta la encuesta y con cuáles
 * falta la reunión. Es el pendiente que más pesa en la meta de 50 clientes —
 * cada cuenta que se va hay que volver a venderla.
 */
export default async function CalidadPage() {
  const me = await requireRole(["admin", "coordinador"]);
  const admin = createAdmin();
  const periodo = currentPeriod();

  const [{ data: clientesRaw }, { data: tokensRaw }, satRes, meetRes] = await Promise.all([
    admin
      .from("clients")
      .select("id, nombre, contacto_nombre, contacto_telefono")
      .eq("estado", "activo")
      .eq("es_interno", false)
      .order("nombre"),
    admin.from("client_portal_tokens").select("cliente_id, token"),
    admin
      .from("client_satisfaction")
      .select("cliente_id, puntaje, que_mejorar")
      .eq("periodo", periodo),
    admin.from("client_meetings").select("cliente_id, fecha").eq("periodo", periodo),
  ]);

  const clientes = (clientesRaw ?? []) as {
    id: string;
    nombre: string;
    contacto_nombre: string | null;
    contacto_telefono: string | null;
  }[];
  const tokenDe = new Map(
    ((tokensRaw ?? []) as { cliente_id: string; token: string }[]).map((t) => [t.cliente_id, t.token])
  );
  // Si falta la migración 0137 estas dos quedan vacías y la pantalla igual sirve.
  const satDe = new Map(
    ((satRes.data ?? []) as { cliente_id: string; puntaje: number; que_mejorar: string | null }[]).map(
      (s) => [s.cliente_id, s]
    )
  );
  const meetDe = new Map(
    ((meetRes.data ?? []) as { cliente_id: string; fecha: string }[]).map((m) => [m.cliente_id, m.fecha])
  );

  const filas: QualityRow[] = clientes.map((c) => ({
    clienteId: c.id,
    nombre: c.nombre,
    contactoNombre: c.contacto_nombre,
    contactoTelefono: c.contacto_telefono,
    portalToken: tokenDe.get(c.id) ?? null,
    puntaje: satDe.get(c.id)?.puntaje ?? null,
    queMejorar: satDe.get(c.id)?.que_mejorar ?? null,
    reunionFecha: meetDe.get(c.id) ?? null,
  }));

  const respondieron = filas.filter((f) => f.puntaje != null);
  const promedio =
    respondieron.length > 0
      ? Math.round((respondieron.reduce((a, f) => a + (f.puntaje ?? 0), 0) / respondieron.length) * 10) / 10
      : null;
  const enRiesgo = respondieron.filter((f) => (f.puntaje ?? 5) <= 2).length;
  const reuniones = filas.filter((f) => f.reunionFecha).length;

  return (
    <div className="space-y-5">
      <Link
        href="/clientes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Clientes
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <HeartHandshake className="h-6 w-6 text-primary" /> Calidad del mes
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          La ronda de {periodLabel(periodo).toLowerCase()}: mandá la encuesta y registrá
          la reunión de cada cuenta desde acá. Lo que contestan alimenta el semáforo
          del Director y la ficha de cada cliente.
        </p>
      </div>

      <div className="grid gap-px overflow-hidden rounded-lg border bg-border sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Encuestas respondidas"
          value={`${respondieron.length} / ${filas.length}`}
          tone={respondieron.length === 0 ? "warn" : undefined}
        />
        <StatCard
          label="Promedio del mes"
          value={promedio != null ? `${promedio} / 5` : "—"}
          tone={promedio != null && promedio >= 4 ? "good" : promedio != null ? "warn" : undefined}
        />
        <StatCard
          label="Para hablar YA"
          value={`${enRiesgo}`}
          sub="puntaje 1 o 2"
          tone={enRiesgo > 0 ? "bad" : undefined}
        />
        <StatCard label="Reuniones hechas" value={`${reuniones} / ${filas.length}`} />
      </div>

      <QualityMonthTable filas={filas} periodo={periodo} miNombre={me.nombre ?? null} />

      <p className="text-xs text-muted-foreground">
        💡 El link de la encuesta es el mismo del portal del cliente + <code>/encuesta</code>,
        así que no hay que mandarle otra dirección. Se puede contestar una vez por mes por
        cuenta.
      </p>
    </div>
  );
}
