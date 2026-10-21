import Link from "next/link";
import { ArrowLeft, Clock } from "lucide-react";
// Los documentos de texto reusan el detalle de agencia/[slug] (mismo contenido, distinto breadcrumb)
import AgencyPageDetail from "@/app/(app)/agencia/[slug]/page";
import { requireUser } from "@/lib/auth";
import { NOMBRE_ROL, ROLES } from "@/lib/equipo/roles";
import { PROCESOS, procesoDe } from "@/lib/procesos/procesos";
import { ProcesoCard, ProcesoVista } from "@/components/proceso-vista";

export const revalidate = 60;

export default async function ProcessDetail({ params }: { params: { slug: string } }) {
  const proceso = procesoDe(params.slug);
  if (!proceso) return AgencyPageDetail({ params });
  await requireUser();

  const paraTodos = proceso.roles.length >= ROLES.length;
  const otros = PROCESOS.filter((p) => p.slug !== proceso.slug && p.roles.some((r) => proceso.roles.includes(r)))
    .sort((a, b) => a.roles.length - b.roles.length)
    .slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <Link href="/procesos" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Procesos
      </Link>

      <header className="animate-in fade-in slide-in-from-bottom-2 flex flex-col gap-4 duration-500 sm:flex-row sm:items-center">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-4xl" aria-hidden="true">
          {proceso.emoji}
        </span>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold leading-tight md:text-3xl">{proceso.titulo}</h1>
          <p className="mt-1 text-muted-foreground">{proceso.para}</p>
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-foreground px-2.5 py-0.5 text-xs font-semibold text-background">
              <Clock className="h-3 w-3" /> {proceso.cuando}
            </span>
            {paraTodos ? (
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">👥 Todo el equipo</span>
            ) : (
              proceso.roles.map((a) => {
                const r = ROLES.find((x) => x.area === a);
                return (
                  <span key={a} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium">
                    {r?.emoji} {NOMBRE_ROL[a] ?? a}
                  </span>
                );
              })
            )}
          </div>
        </div>
      </header>

      <ProcesoVista proceso={proceso} />

      {otros.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Sigue con</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {otros.map((p) => (
              <ProcesoCard key={p.slug} proceso={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
