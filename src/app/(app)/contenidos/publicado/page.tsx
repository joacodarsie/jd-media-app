import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ChevronLeft, ChevronRight } from "lucide-react";
import { requireUser, isStaffUser, userInRoles, getAccessibleClientIds } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd, ymdEnZona } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PUEDE_VER = ["admin", "coordinador", "coordinador_diseno", "community_manager"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type Media = {
  id: string;
  permalink: string | null;
  thumbnail_url: string | null;
  timestamp: string | null;
  media_type: string | null;
};

type Pieza = { id: string; cliente: string; clienteId: string; link: string; img: string | null; tipo: string; dia: string };

function mover(mes: string, n: number) {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

/**
 * Lo que salió en Instagram, en un calendario (12/10/2026).
 *
 * Pedido del dueño: ver de un vistazo todo lo que se va subiendo en las cuentas.
 * No consulta a Meta: usa el feed que el sync diario ya guarda en
 * `ig_snapshots` (el último registro de cada cuenta en ese mes). Solo entran las
 * cuentas con el Instagram conectado.
 */
export default async function PublicadoPage({
  searchParams,
}: {
  searchParams?: { mes?: string; cliente?: string };
}) {
  const me = await requireUser();
  if (!isStaffUser(me) && !userInRoles(me, PUEDE_VER)) redirect("/contenidos");

  const hoy = hoyYmd();
  const mes = /^\d{4}-\d{2}$/.test(searchParams?.mes ?? "") ? searchParams!.mes! : hoy.slice(0, 7);
  const filtro = searchParams?.cliente ?? null;
  const admin = createAdmin();
  const misClientes = await getAccessibleClientIds(me);

  const desde = `${mes}-01`;
  const hasta = `${mover(mes, 1)}-01`;
  const [{ data: snaps }, { data: clientesRaw }] = await Promise.all([
    admin
      .from("ig_snapshots")
      .select("cliente_id, fecha, detalle")
      .gte("fecha", desde)
      .lt("fecha", hasta)
      .order("fecha", { ascending: false }),
    admin.from("clients").select("id, nombre, estado, es_interno, ig_user_id").eq("estado", "activo"),
  ]);
  const clientes = (clientesRaw ?? []) as {
    id: string;
    nombre: string;
    es_interno: boolean;
    ig_user_id: string | null;
  }[];
  const nombreDe = new Map(clientes.map((c) => [c.id, c.nombre]));
  const visible = (id: string) => nombreDe.has(id) && (!misClientes || misClientes.includes(id));

  // El último registro de cada cuenta en el mes trae todo lo publicado hasta ese día.
  const ultimo = new Map<string, Media[]>();
  for (const s of (snaps ?? []) as { cliente_id: string; detalle: { media?: Media[] } | null }[]) {
    if (ultimo.has(s.cliente_id) || !visible(s.cliente_id)) continue;
    ultimo.set(s.cliente_id, s.detalle?.media ?? []);
  }
  const piezas: Pieza[] = [];
  for (const [clienteId, media] of ultimo) {
    for (const m of media) {
      const dia = ymdEnZona(m.timestamp);
      if (!dia || dia.slice(0, 7) !== mes || !m.permalink) continue;
      piezas.push({
        id: m.id,
        cliente: nombreDe.get(clienteId) ?? "—",
        clienteId,
        link: m.permalink,
        img: m.thumbnail_url,
        tipo: m.media_type === "VIDEO" ? "Reel" : m.media_type === "CAROUSEL_ALBUM" ? "Carrusel" : "Post",
        dia,
      });
    }
  }
  const porCuenta = new Map<string, { nombre: string; n: number }>();
  for (const p of piezas) {
    const e = porCuenta.get(p.clienteId) ?? { nombre: p.cliente, n: 0 };
    e.n++;
    porCuenta.set(p.clienteId, e);
  }
  const lista = filtro ? piezas.filter((p) => p.clienteId === filtro) : piezas;
  const porDia = new Map<string, Pieza[]>();
  for (const p of lista) porDia.set(p.dia, [...(porDia.get(p.dia) ?? []), p]);

  // La grilla del mes, de lunes a domingo.
  const [y, m] = mes.split("-").map(Number);
  const primero = new Date(Date.UTC(y, m - 1, 1));
  const offset = (primero.getUTCDay() + 6) % 7;
  const diasMes = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const celdas: (string | null)[] = [
    ...Array.from({ length: offset }, () => null),
    ...Array.from({ length: diasMes }, (_, i) => `${mes}-${String(i + 1).padStart(2, "0")}`),
  ];
  while (celdas.length % 7) celdas.push(null);

  const sinConectar = clientes.filter((c) => !c.es_interno && !c.ig_user_id).length;
  const conectadas = clientes.filter((c) => !c.es_interno && c.ig_user_id).length;
  const q = (extra: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const v = { mes, cliente: filtro, ...extra };
    for (const [k, val] of Object.entries(v)) if (val) params.set(k, val);
    return `/contenidos/publicado?${params.toString()}`;
  };

  return (
    <div className="space-y-4">
      <Link href="/contenidos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al calendario
      </Link>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Lo que salió en Instagram</h1>
          <p className="text-muted-foreground">
            Todo lo publicado en las cuentas conectadas, día por día. Tocá una pieza para verla en Instagram.
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Link href={q({ mes: mover(mes, -1) })} className="rounded-md border p-2 hover:bg-accent" aria-label="Mes anterior">
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <span className="min-w-[140px] text-center font-semibold">
            {MESES[m - 1]} {y}
          </span>
          <Link href={q({ mes: mover(mes, 1) })} className="rounded-md border p-2 hover:bg-accent" aria-label="Mes siguiente">
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <Link
          href={q({ cliente: null })}
          className={cn("rounded-full border px-2.5 py-1", !filtro ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
        >
          Todas ({piezas.length})
        </Link>
        {[...porCuenta].sort((a, b) => b[1].n - a[1].n).map(([id, c]) => (
          <Link
            key={id}
            href={q({ cliente: id })}
            className={cn("rounded-full border px-2.5 py-1", filtro === id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-accent")}
          >
            {c.nombre} ({c.n})
          </Link>
        ))}
        <span className="text-muted-foreground">
          · {conectadas} cuentas conectadas, {sinConectar} sin conectar (no aparecen acá)
        </span>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[760px] grid-cols-7 gap-px overflow-hidden rounded-lg border bg-border text-sm">
          {DOW.map((d) => (
            <div key={d} className="bg-muted px-2 py-1.5 text-center text-xs font-medium text-muted-foreground">
              {d}
            </div>
          ))}
          {celdas.map((dia, i) => {
            const items = dia ? porDia.get(dia) ?? [] : [];
            return (
              <div key={dia ?? `v${i}`} className={cn("min-h-28 bg-card p-1.5", !dia && "bg-muted/40")}>
                {dia && (
                  <div className={cn("mb-1 text-right text-xs", dia === hoy && "font-bold text-primary")}>
                    {Number(dia.slice(8, 10))}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-1">
                  {items.map((p) => (
                    <a
                      key={p.id}
                      href={p.link}
                      target="_blank"
                      rel="noreferrer"
                      title={`${p.cliente} · ${p.tipo}`}
                      className="group relative block aspect-square overflow-hidden rounded border bg-muted"
                    >
                      {p.img ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.img} alt={p.cliente} loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center p-1 text-center text-[9px]">{p.cliente}</span>
                      )}
                      <span className="absolute inset-x-0 bottom-0 truncate bg-black/60 px-1 text-[9px] font-medium text-white">
                        {p.cliente}
                      </span>
                    </a>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
      {piezas.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No hay publicaciones registradas este mes en las cuentas conectadas.
        </p>
      )}
    </div>
  );
}
