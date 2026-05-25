import Link from "next/link";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { requireUser, isStaff } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { AgencyPageDialog } from "@/components/agency-page-dialog";

export const revalidate = 60;

const KIND_LABEL: Record<string, string> = {
  proceso: "Procesos / SOPs",
  plantilla: "Plantillas",
  otro: "Otros",
};

export default async function ProcesosPage() {
  const me = await requireUser();
  const supabase = createClient();
  const { data: pages } = await supabase
    .from("agency_pages")
    .select("*")
    .in("kind", ["proceso", "plantilla", "otro"])
    .order("kind")
    .order("orden");

  const byKind = new Map<string, typeof pages>();
  for (const p of pages ?? []) {
    if (!byKind.has(p.kind)) byKind.set(p.kind, []);
    byKind.get(p.kind)!.push(p);
  }

  const canEdit = isStaff(me.rol);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Procesos</h1>
          <p className="text-muted-foreground">
            SOPs, plantillas y formas de hacer las cosas dentro de JD Media.
          </p>
        </div>
        {canEdit && (
          <AgencyPageDialog
            mode="create"
            defaultKind="proceso"
            trigger={
              <Button>
                <Plus className="mr-2 h-4 w-4" /> Nuevo proceso
              </Button>
            }
          />
        )}
      </div>

      {Array.from(byKind.entries()).map(([kind, list]) => (
        <section key={kind} className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {KIND_LABEL[kind] ?? kind}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {(list ?? []).map((p) => (
              <Link
                key={p.slug}
                href={`/procesos/${p.slug}`}
                className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold">{p.title}</h3>
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                </div>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
