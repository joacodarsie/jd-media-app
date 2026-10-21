import Link from "next/link";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { requireUser, isStaffUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { AgencyPageDialog } from "@/components/agency-page-dialog";
import { SectionTabs } from "@/components/section-tabs";
import { ProcesoCard } from "@/components/proceso-vista";
import { conocimientoTabs } from "@/lib/section-tabs";
import { NOMBRE_ROL, ROLES } from "@/lib/equipo/roles";
import { PROCESOS, procesosDe } from "@/lib/procesos/procesos";
import { cn } from "@/lib/utils";

export const revalidate = 60;

/**
 * Procesos (21/10/2026): arriba «Cómo trabajamos» (las fechas de todos), después
 * los procesos dibujados en pasos, filtrables por rol, y al final los documentos
 * de texto que ya existían. Por defecto muestra los del rol de quien entra.
 */
export default async function ProcesosPage({ searchParams }: { searchParams: { rol?: string } }) {
  const me = await requireUser();
  const supabase = createClient();
  const { data: pages } = await supabase
    .from("agency_pages")
    .select("slug, title, kind, orden")
    .in("kind", ["proceso", "plantilla", "otro"])
    .order("kind")
    .order("orden");

  const roles = ROLES.filter((r) => PROCESOS.some((p) => p.roles.includes(r.area) && p.roles.length < ROLES.length));
  const elegido = searchParams.rol === "todos" ? null : searchParams.rol ?? (me.area && roles.some((r) => r.area === me.area) ? me.area : null);
  const lista = elegido ? procesosDe(elegido) : PROCESOS;
  const plataforma = lista.filter((p) => p.tipo === "plataforma");
  const trabajo = lista.filter((p) => p.tipo === "trabajo");
  const canEdit = isStaffUser(me);

  return (
    <div className="space-y-6">
      <SectionTabs tabs={conocimientoTabs} />

      <div>
        <h1 className="text-2xl font-bold">Procesos</h1>
        <p className="text-muted-foreground">Cómo se hace cada cosa, paso a paso y con dónde se hace.</p>
      </div>

      <Link
        href="/procesos/como-trabajamos"
        className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-gradient-to-br from-sky-500/15 via-violet-500/10 to-transparent p-5 transition-colors hover:border-primary/40"
      >
        <span className="text-4xl" aria-hidden="true">🗓️</span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-semibold">Cómo trabajamos</span>
          <span className="block text-sm text-muted-foreground">Las quincenas, el mes de cada rol, el arranque de una cuenta y las fechas de la plata.</span>
        </span>
        <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
      </Link>

      {/* Filtro por rol */}
      <nav className="flex flex-wrap gap-1.5" aria-label="Filtrar por rol">
        <Chip href="/procesos?rol=todos" activo={!elegido}>
          Todos
        </Chip>
        {roles.map((r) => (
          <Chip key={r.area} href={`/procesos?rol=${encodeURIComponent(r.area)}`} activo={elegido === r.area}>
            <span aria-hidden="true">{r.emoji}</span> {NOMBRE_ROL[r.area] ?? r.area}
          </Chip>
        ))}
      </nav>

      {trabajo.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">🧩 El trabajo</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {trabajo.map((p) => (
              <ProcesoCard key={p.slug} proceso={p} />
            ))}
          </div>
        </section>
      )}

      {plataforma.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">💻 Usar la plataforma</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {plataforma.map((p) => (
              <ProcesoCard key={p.slug} proceso={p} />
            ))}
          </div>
        </section>
      )}

      {/* Documentos de texto que ya existían */}
      <section className="space-y-2 border-t pt-5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">📄 Documentos y plantillas</h2>
          {canEdit && (
            <AgencyPageDialog
              mode="create"
              defaultKind="proceso"
              trigger={
                <Button size="sm" variant="outline">
                  <Plus className="mr-1.5 h-4 w-4" /> Nuevo documento
                </Button>
              }
            />
          )}
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {(pages ?? []).map((p) => (
            <Link
              key={p.slug}
              href={`/procesos/${p.slug}`}
              className="group flex items-center justify-between gap-2 rounded-xl border bg-card px-3 py-2.5 text-sm transition-colors hover:border-primary/40"
            >
              <span className="flex min-w-0 items-center gap-2">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate">{p.title}</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function Chip({ href, activo, children }: { href: string; activo: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        activo ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted"
      )}
    >
      {children}
    </Link>
  );
}
