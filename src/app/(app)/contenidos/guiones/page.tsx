import Link from "next/link";
import { requireUser, getAccessibleClientIds } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { getActiveClients, getActiveUsers } from "@/lib/cache";
import {
  CopyBlockButton,
  PersonaSelect,
  PrintButton,
} from "@/components/guiones-toolbar";

export const dynamic = "force-dynamic";

/**
 * Guiones del mes: todo el contenido del calendario en una sola hoja, separado
 * por cuenta (pestañas) y por tipo (edición: reels/videos · diseño:
 * posteos/carruseles · historias). Pedido del equipo: en vez de entrar idea
 * por idea al calendario, el editor/diseñador ve o descarga todo lo suyo de
 * una, como los docs que armaban a mano.
 */

const TIPO_LABEL: Record<string, string> = {
  post: "POSTEO",
  carrusel: "CARRUSEL",
  reel: "REEL",
  video_largo: "VIDEO",
  historia: "HISTORIA",
  live: "LIVE",
  otro: "OTRO",
};

const SECCIONES = [
  {
    key: "edicion",
    label: "🎬 Edición · Reels y videos",
    tipos: ["reel", "video_largo"],
  },
  {
    key: "diseno",
    label: "🎨 Diseño · Posteos y carruseles",
    tipos: ["post", "carrusel"],
  },
  { key: "historias", label: "⚡ Historias", tipos: ["historia"] },
  { key: "otros", label: "Otros", tipos: ["live", "otro"] },
] as const;

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface PubRow {
  id: string;
  cliente_id: string;
  titulo: string;
  descripcion: string | null;
  copy: string | null;
  guion: string | null;
  red: string;
  tipo: string;
  estado: string;
  fecha_publicacion: string | null;
  hashtags: string | null;
  audiovisual_id: string | null;
  disenador_id: string | null;
}

interface ClientRow {
  id: string;
  nombre: string;
  cm_id: string | null;
  disenador_id: string | null;
  audiovisual_id: string | null;
}

function shiftPeriodo(periodo: string, delta: number) {
  const [y, m] = periodo.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function fechaCorta(iso: string | null) {
  if (!iso) return "sin fecha";
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

/** Quién es el dueño de la pieza según su tipo (pub primero, equipo del cliente de fallback). */
function esDePersona(p: PubRow, client: ClientRow | undefined, persona: string) {
  const design = p.disenador_id ?? client?.disenador_id;
  const edit = p.audiovisual_id ?? client?.audiovisual_id;
  if (p.tipo === "reel" || p.tipo === "video_largo") return edit === persona;
  if (p.tipo === "post" || p.tipo === "carrusel") return design === persona;
  // Historias y otros: cuentan para cualquiera del equipo de la pieza/cuenta.
  return [design, edit, client?.cm_id].includes(persona);
}

function textoPieza(p: PubRow) {
  const partes = [
    `${TIPO_LABEL[p.tipo] ?? p.tipo.toUpperCase()} ${fechaCorta(p.fecha_publicacion)}: ${p.titulo}`,
  ];
  if (p.guion) partes.push(p.guion.trim());
  if (p.descripcion) partes.push(p.descripcion.trim());
  if (p.copy) partes.push(`Copy: ${p.copy.trim()}`);
  if (p.hashtags) partes.push(`Hashtags: ${p.hashtags.trim()}`);
  return partes.join("\n");
}

export default async function GuionesPage({
  searchParams,
}: {
  searchParams?: { periodo?: string; cliente?: string; persona?: string };
}) {
  const me = await requireUser();
  const supabase = createClient();

  const now = new Date();
  const actual = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const periodo = /^\d{4}-\d{2}$/.test(searchParams?.periodo ?? "")
    ? (searchParams!.periodo as string)
    : actual;
  const desde = `${periodo}-01`;
  const hasta = `${shiftPeriodo(periodo, 1)}-01`;
  const [anio, mes] = periodo.split("-").map(Number);
  const periodoLabel = `${MESES[mes - 1]} ${anio}`;

  const myClientIds = await getAccessibleClientIds(me);

  let pubQuery = supabase
    .from("publications")
    .select(
      "id, cliente_id, titulo, descripcion, copy, guion, red, tipo, estado, fecha_publicacion, hashtags, audiovisual_id, disenador_id"
    )
    .gte("fecha_publicacion", desde)
    .lt("fecha_publicacion", hasta)
    .neq("estado", "rechazado")
    .order("fecha_publicacion", { ascending: true });
  if (myClientIds) pubQuery = pubQuery.in("cliente_id", myClientIds);

  const [{ data: pubsRaw }, allClients] = await Promise.all([
    pubQuery,
    getActiveClients(),
  ]);
  const pubs = (pubsRaw ?? []) as PubRow[];
  const clientById = new Map(
    (allClients as ClientRow[]).map((c) => [c.id, c])
  );

  // Personas disponibles = equipo que aparece en las piezas/cuentas del mes.
  const usersRaw = await getActiveUsers();
  const userName = new Map(usersRaw.map((u) => [u.id, u.nombre]));
  const personaIds = new Set<string>();
  for (const p of pubs) {
    const c = clientById.get(p.cliente_id);
    for (const id of [
      p.disenador_id ?? c?.disenador_id,
      p.audiovisual_id ?? c?.audiovisual_id,
    ])
      if (id && userName.has(id)) personaIds.add(id);
  }
  const personaOptions = [...personaIds]
    .map((id) => ({ id, nombre: userName.get(id) as string }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const persona = searchParams?.persona;
  const filtradas = persona
    ? pubs.filter((p) => esDePersona(p, clientById.get(p.cliente_id), persona))
    : pubs;

  // Pestañas de cuentas (solo las que tienen piezas este mes, tras el filtro).
  const porCliente = new Map<string, PubRow[]>();
  for (const p of filtradas) {
    if (!porCliente.has(p.cliente_id)) porCliente.set(p.cliente_id, []);
    porCliente.get(p.cliente_id)!.push(p);
  }
  const cuentas = [...porCliente.keys()]
    .map((id) => ({
      id,
      nombre: clientById.get(id)?.nombre ?? "¿?",
      count: porCliente.get(id)!.length,
    }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre));

  const clienteSel =
    searchParams?.cliente && porCliente.has(searchParams.cliente)
      ? searchParams.cliente
      : undefined;
  const cuentasVisibles = clienteSel
    ? cuentas.filter((c) => c.id === clienteSel)
    : cuentas;

  const qs = (over: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const merged = { periodo, cliente: clienteSel, persona, ...over };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };

  return (
    <div className="space-y-5">
      {/* Al imprimir: solo el documento, sin shell ni controles. */}
      <style>{`@media print {
        aside, header, .no-print { display: none !important; }
        main { padding: 0 !important; }
      }`}</style>

      <div className="no-print">
        <h1 className="text-2xl font-bold">Guiones del mes</h1>
        <p className="text-muted-foreground">
          Todo el contenido del calendario en una sola hoja, separado por
          cuenta y por tipo. Filtrá por persona para ver o descargar solo lo
          tuyo.
        </p>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2">
        <div className="flex items-center rounded-md border bg-background">
          <Link
            href={qs({ periodo: shiftPeriodo(periodo, -1) })}
            className="px-3 py-1.5 text-sm hover:bg-accent"
          >
            ‹
          </Link>
          <span className="px-2 text-sm font-semibold">{periodoLabel}</span>
          <Link
            href={qs({ periodo: shiftPeriodo(periodo, 1) })}
            className="px-3 py-1.5 text-sm hover:bg-accent"
          >
            ›
          </Link>
        </div>
        <PersonaSelect options={personaOptions} value={persona} />
        <PrintButton />
        <Link
          href="/contenidos"
          className="ml-auto text-sm text-muted-foreground underline-offset-2 hover:underline"
        >
          ← Volver al calendario
        </Link>
      </div>

      {cuentas.length > 1 && (
        <div className="no-print flex flex-wrap gap-1.5">
          <Link
            href={qs({ cliente: undefined })}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${!clienteSel ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-accent"}`}
          >
            Todas las cuentas
          </Link>
          {cuentas.map((c) => (
            <Link
              key={c.id}
              href={qs({ cliente: c.id })}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${clienteSel === c.id ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-accent"}`}
            >
              {c.nombre} · {c.count}
            </Link>
          ))}
        </div>
      )}

      {cuentasVisibles.length === 0 && (
        <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground">
          No hay piezas en el calendario para {periodoLabel}
          {persona ? " de esa persona" : ""}.
        </div>
      )}

      {cuentasVisibles.map((cuenta) => {
        const piezas = porCliente.get(cuenta.id)!;
        return (
          <section
            key={cuenta.id}
            className="rounded-lg border bg-card p-4 md:p-6"
            style={{ breakInside: "avoid-page" }}
          >
            <h2 className="mb-1 text-xl font-bold">{cuenta.nombre}</h2>
            <p className="mb-4 text-xs text-muted-foreground">
              {periodoLabel} · {piezas.length}{" "}
              {piezas.length === 1 ? "pieza" : "piezas"}
            </p>

            {SECCIONES.map((sec) => {
              const delTipo = piezas.filter((p) =>
                (sec.tipos as readonly string[]).includes(p.tipo)
              );
              if (delTipo.length === 0) return null;
              const bloque = delTipo.map(textoPieza).join("\n\n---\n\n");
              return (
                <div key={sec.key} className="mb-6 last:mb-0">
                  <div className="mb-2 flex items-center justify-between gap-2 border-b pb-1.5">
                    <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                      {sec.label} · {delTipo.length}
                    </h3>
                    <span className="no-print">
                      <CopyBlockButton
                        text={`${cuenta.nombre} — ${periodoLabel} — ${sec.label}\n\n${bloque}`}
                      />
                    </span>
                  </div>
                  <div className="space-y-4">
                    {delTipo.map((p) => (
                      <article key={p.id}>
                        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                          {TIPO_LABEL[p.tipo] ?? p.tipo} ·{" "}
                          {fechaCorta(p.fecha_publicacion)} · {p.red}
                          {p.estado === "publicado" && " · ✅ publicado"}
                        </div>
                        <div className="font-semibold">{p.titulo}</div>
                        {p.guion && (
                          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                            {p.guion}
                          </p>
                        )}
                        {p.descripcion && (
                          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-foreground/80">
                            {p.descripcion}
                          </p>
                        )}
                        {p.copy && (
                          <p className="mt-1 whitespace-pre-line text-sm text-foreground/70">
                            <span className="font-medium">Copy:</span> {p.copy}
                          </p>
                        )}
                        {p.hashtags && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            {p.hashtags}
                          </p>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              );
            })}
          </section>
        );
      })}
    </div>
  );
}
