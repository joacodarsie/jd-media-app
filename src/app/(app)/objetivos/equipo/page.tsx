import { Target } from "lucide-react";
import { requireUser, isStaffUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import {
  METRICAS,
  avance,
  mesDe,
  metricasDe,
  semanaDe,
  type DatosObjetivos,
  type MetricaId,
  type PersonaObj,
} from "@/lib/objetivos/equipo";
import { ObjetivosEquipo, type FichaPersona } from "@/components/objetivos-equipo";

export const dynamic = "force-dynamic";

type Admin = ReturnType<typeof createAdmin>;

/** Una consulta entera, de a 1.000 filas (la base corta en 1.000). */
async function todo<T>(armar: (desde: number, hasta: number) => PromiseLike<{ data: unknown; error: unknown }>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; ; i += 1000) {
    const { data, error } = await armar(i, i + 999);
    if (error) break;
    const filas = (data ?? []) as T[];
    out.push(...filas);
    if (filas.length < 1000) break;
  }
  return out;
}

async function cargarDatos(admin: Admin, desde: string, hasta: string): Promise<DatosObjetivos> {
  const [contactos, propuestas, clientes, publicaciones, tareasCerradas, reunionesMensuales] = await Promise.all([
    todo<DatosObjetivos["contactos"][number]>((a, b) =>
      admin
        .from("prospecting_contacts")
        .select("asignado_a, contactado_at, reunion_at")
        .or(`contactado_at.gte.${desde},reunion_at.gte.${desde}`)
        .order("id")
        .range(a, b)
    ),
    todo<DatosObjetivos["propuestas"][number]>((a, b) =>
      admin.from("proposals").select("creada_por_id, created_at").gte("created_at", desde).order("id").range(a, b)
    ),
    todo<DatosObjetivos["clientes"][number]>((a, b) =>
      admin
        .from("clients")
        .select("id, estado, es_interno, cm_id, disenador_id, audiovisual_id, cerrado_por_id, fecha_activado")
        .order("id")
        .range(a, b)
    ),
    todo<DatosObjetivos["publicaciones"][number]>((a, b) =>
      admin
        .from("publications")
        .select("cliente_id, tipo, estado, fecha_publicacion")
        .gte("fecha_publicacion", desde)
        .lt("fecha_publicacion", hasta)
        .order("id")
        .range(a, b)
    ),
    todo<DatosObjetivos["tareasCerradas"][number]>((a, b) =>
      admin
        .from("tasks")
        .select("asignado_a_id, area, fecha_completada")
        .in("area", ["Diseño", "Edición Audiovisual"])
        .gte("fecha_completada", desde)
        .order("id")
        .range(a, b)
    ),
    todo<DatosObjetivos["reunionesMensuales"][number]>((a, b) =>
      admin.from("client_meetings").select("cliente_id, fecha").gte("fecha", desde).order("id").range(a, b)
    ),
  ]);
  return { contactos, propuestas, clientes, publicaciones, tareasCerradas, reunionesMensuales };
}

export default async function ObjetivosEquipoPage() {
  const me = await requireUser();
  const staff = isStaffUser(me);
  const canEdit = userInRoles(me, ["admin", "coordinador"]);
  const admin = createAdmin();

  const hoy = hoyYmd();
  const semana = semanaDe(hoy);
  const mes = mesDe(hoy);
  const desde = semana.desde < mes.desde ? semana.desde : mes.desde;
  const hasta = semana.hasta > mes.hasta ? semana.hasta : mes.hasta;

  const [{ data: usersRaw }, { data: metasRaw }, datos] = await Promise.all([
    admin
      .from("users")
      .select("id, nombre, rol, rol_secundario, area, area_secundaria")
      .eq("activo", true)
      .order("nombre"),
    admin.from("objetivos_persona").select("user_id, metrica, meta_semanal, meta_mensual"),
    cargarDatos(admin, desde, hasta),
  ]);

  const metas = new Map<string, { semanal: number | null; mensual: number | null }>();
  for (const m of (metasRaw ?? []) as { user_id: string; metrica: string; meta_semanal: number | null; meta_mensual: number | null }[]) {
    metas.set(`${m.user_id}:${m.metrica}`, {
      semanal: m.meta_semanal == null ? null : Number(m.meta_semanal),
      mensual: m.meta_mensual == null ? null : Number(m.meta_mensual),
    });
  }

  // Cada uno ve los suyos; dirección y coordinación ven a todo el equipo.
  const personas = ((usersRaw ?? []) as PersonaObj[]).filter((p) => staff || p.id === me.id);

  const fichas: FichaPersona[] = personas
    .map((p) => ({
      persona: p,
      metricas: metricasDe(p).map((id: MetricaId) => {
        const def = METRICAS[id];
        const manual = metas.get(`${p.id}:${id}`) ?? { semanal: null, mensual: null };
        return {
          id,
          label: def.label,
          ayuda: def.ayuda,
          unidad: def.unidad,
          metaManual: def.metaManual,
          semana: def.soloMes ? null : avance(id, p.id, datos, semana, manual.semanal),
          mes: avance(id, p.id, datos, mes, manual.mensual),
          metaSemanalGuardada: manual.semanal,
          metaMensualGuardada: manual.mensual,
        };
      }),
    }))
    .filter((f) => f.metricas.length > 0)
    // Primero quien mira; después el resto.
    .sort((a, b) => (a.persona.id === me.id ? -1 : b.persona.id === me.id ? 1 : 0));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Target className="h-6 w-6 text-primary" /> Objetivos del equipo
        </h1>
        <p className="text-muted-foreground">
          Lo que se le mide a cada uno, esta semana (lunes a domingo) y este mes. Se calcula solo con lo
          que pasa en la app. Cuando no hay una meta puesta a mano, la meta es lo que se vendió.
        </p>
      </div>
      {fichas.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Todavía no hay objetivos medibles para tu rol.
        </p>
      ) : (
        <ObjetivosEquipo fichas={fichas} canEdit={canEdit} />
      )}
    </div>
  );
}
