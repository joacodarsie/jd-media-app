import Link from "next/link";
import { ArrowRight, KeyRound, Plus, ShieldAlert } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AgencyPageDialog } from "@/components/agency-page-dialog";

export const dynamic = "force-dynamic";

export default async function AccesosPage() {
  // Restringido a admin SOLAMENTE (no coordinación)
  await requireRole(["admin"]);
  const supabase = createClient();
  const { data: pages } = await supabase
    .from("agency_pages")
    .select("slug, title, content, orden, updated_at")
    .eq("kind", "accesos")
    .order("orden")
    .order("title");

  const list = pages ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-primary" />
            <h1 className="text-2xl font-bold">Accesos</h1>
            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-red-700 dark:bg-red-950 dark:text-red-300">
              Privado
            </span>
          </div>
          <p className="text-muted-foreground">
            Credenciales internas de JD Media. Solo vos podés ver y editar esta
            sección.
          </p>
        </div>
        <AgencyPageDialog
          mode="create"
          defaultKind="accesos"
          trigger={
            <Button>
              <Plus className="mr-2 h-4 w-4" /> Nuevo acceso
            </Button>
          }
        />
      </div>

      <Card className="border-amber-300 bg-amber-50/40 dark:border-amber-900 dark:bg-amber-950/20">
        <CardContent className="flex items-start gap-2 p-3 text-xs">
          <ShieldAlert className="mt-0.5 h-4 w-4 text-amber-700" />
          <p className="text-amber-900 dark:text-amber-200">
            Esta sección está restringida sólo a admin. Si necesitás compartir un
            acceso con el equipo, mantelo en <b>Procesos</b> en lugar de acá.
          </p>
        </CardContent>
      </Card>

      {list.length === 0 ? (
        <div className="rounded-md border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          Sin accesos cargados todavía. Tocá <b>Nuevo acceso</b> para empezar.
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {list.map((p) => (
            <Link
              key={p.slug}
              href={`/agencia/${p.slug}`}
              className="group rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-primary" />
                  <h3 className="font-semibold">{p.title}</h3>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </div>
              {p.content && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                  {p.content.slice(0, 120)}…
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
