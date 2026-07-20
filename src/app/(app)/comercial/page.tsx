import Link from "next/link";
import { Sparkles, GraduationCap, FileClock, Radar, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { redirect } from "next/navigation";
import { requireUser, userHas } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { Button } from "@/components/ui/button";
import { NewProposalDialog } from "@/components/new-proposal-dialog";
import { CopyRequestDataButton } from "@/components/copy-request-data-button";
import { HelpTrigger } from "@/components/help-trigger";
import { whatsappLink } from "@/lib/payment-reminder";

export const dynamic = "force-dynamic";

const COMERCIAL_ROLES = ["admin", "coordinador", "comercial", "prospecting"];

// Buckets de seguimiento por antigüedad de la propuesta (días desde que se creó).
function seguimientoBucket(dias: number): {
  label: string;
  urgente: boolean;
  badge: string;
} {
  if (dias >= 7)
    return {
      label: "En riesgo — seguila ya",
      urgente: true,
      badge: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
    };
  if (dias >= 3)
    return {
      label: "Seguila",
      urgente: true,
      badge: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    };
  return {
    label: "Reciente",
    urgente: false,
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  };
}

function followupMessage(nombre: string): string {
  const first = nombre.split(" ")[0];
  return `¡Hola ${first}! ¿Cómo va? Te escribo de JD Media para saber si pudiste ver la propuesta que te pasé 😊 Cualquier duda quedo a disposición para avanzar cuando quieras.`;
}

export default async function ComercialPage() {
  const me = await requireUser();
  const rolOk =
    COMERCIAL_ROLES.includes(me.rol) ||
    (!!me.rol_secundario && COMERCIAL_ROLES.includes(me.rol_secundario));
  if (!rolOk && !userHas(me, "comercial")) {
    redirect("/dashboard");
  }
  const supabase = createClient();
  const admin = createAdmin();

  const [{ data: services }, { data: users }, { data: propuestas }] = await Promise.all([
    supabase.from("services").select("slug, name").eq("active", true).order("orden"),
    supabase.from("users").select("id, nombre, rol, rol_secundario").eq("activo", true).order("nombre"),
    // Propuestas (clientes en estado "propuesta"): cartas acuerdo enviadas que
    // todavía no se activaron. Es el embudo real de comercial. Más viejas primero.
    admin
      .from("clients")
      .select("id, nombre, created_at, monto_mensual, contacto_telefono")
      .eq("estado", "propuesta")
      .order("created_at", { ascending: true }),
  ]);

  const propuestasRows = (propuestas ?? []) as {
    id: string;
    nombre: string;
    created_at: string | null;
    monto_mensual: number | null;
    contacto_telefono: string | null;
  }[];
  const diasDesde = (iso: string | null): number =>
    iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400_000) : 0;
  const enRiesgo = propuestasRows.filter((p) => diasDesde(p.created_at) >= 3).length;

  // Coordinadoras candidatas (rol coordinación, primario o secundario) para
  // asignar la cuenta al crear la propuesta.
  const usersRows = (users ?? []) as {
    id: string;
    nombre: string;
    rol: string;
    rol_secundario: string | null;
  }[];
  const coordinadores = usersRows
    .filter((u) => u.rol === "coordinador" || u.rol_secundario === "coordinador")
    .map((u) => ({ id: u.id, nombre: u.nombre }));
  const defaultCoordinadorId = coordinadores.length === 1 ? coordinadores[0].id : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            Comercial
            <HelpTrigger slug="comercial" label="Cómo usar la sección comercial" size="md" />
          </h1>
          <p className="text-muted-foreground">
            Cuando un prospecto te pasa los datos, generá la carta acuerdo a un toque
            y seguila hasta que pague.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/comercial/leads" title="Pipeline de leads (consultas antes de la propuesta)">
              <Radar className="h-4 w-4 text-primary" />
              Leads
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/comercial/feedback" title="Feedback de una reunión comercial con IA">
              <GraduationCap className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Feedback de reunión</span>
              <span className="sm:hidden">Feedback</span>
            </Link>
          </Button>
          <Button asChild variant="outline" className="gap-1.5">
            <Link href="/comercial/post-meet" title="Generar mensaje post-meet con IA">
              <Sparkles className="h-4 w-4 text-primary" />
              <span className="hidden sm:inline">Mensaje post-meet</span>
              <span className="sm:hidden">Post-meet</span>
            </Link>
          </Button>
          <CopyRequestDataButton />
          <NewProposalDialog
            services={services ?? []}
            users={(users ?? []) as { id: string; nombre: string }[]}
            coordinadores={coordinadores}
            defaultCoordinadorId={defaultCoordinadorId}
          />
        </div>
      </div>

      {/* Prospección: el techo del embudo */}
      <Link
        href="/prospeccion"
        className="group flex items-center justify-between gap-3 rounded-xl border bg-card p-4 transition-colors hover:border-primary/40"
      >
        <div className="flex items-center gap-3">
          <Radar className="h-5 w-5 text-primary" />
          <div>
            <div className="font-semibold">Prospección</div>
            <p className="text-sm text-muted-foreground">
              ¿Pocas propuestas en curso? Buscá nuevos leads con IA y armá campañas
              de captación.
            </p>
          </div>
        </div>
        <span className="shrink-0 text-sm text-primary group-hover:underline">Ir →</span>
      </Link>

      {/* Seguimiento de propuestas */}
      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <FileClock className="h-5 w-5 text-primary" /> Seguimiento de propuestas
          </h2>
          {propuestasRows.length > 0 && (
            <span className="text-xs text-muted-foreground">
              {propuestasRows.length} en curso
              {enRiesgo > 0 && (
                <span className="ml-1 font-medium text-amber-600 dark:text-amber-400">
                  · {enRiesgo} para seguir
                </span>
              )}
            </span>
          )}
        </div>

        {propuestasRows.length === 0 ? (
          <div className="rounded-lg border border-dashed bg-muted/20 p-6 text-sm text-muted-foreground">
            No hay propuestas en curso. Cuando un prospecto te pase los datos, tocá{" "}
            <b className="text-foreground">Nueva propuesta</b>: cargás sus datos, armás
            la carta acuerdo y se la mandás con los datos de pago. Cuando transfiere, la
            activás y se vuelve cliente.
          </div>
        ) : (
          <ul className="space-y-2">
            {propuestasRows.map((p) => {
              const dias = diasDesde(p.created_at);
              const b = seguimientoBucket(dias);
              const wa = whatsappLink(p.contacto_telefono, followupMessage(p.nombre));
              return (
                <li
                  key={p.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3",
                    b.urgente && "border-amber-300/60 dark:border-amber-900/60"
                  )}
                >
                  <div className="min-w-0">
                    <Link href={`/clientes/${p.id}`} className="font-medium hover:underline">
                      {p.nombre}
                    </Link>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs">
                      <span className={cn("rounded-full px-2 py-0.5 font-medium", b.badge)}>
                        {b.label}
                      </span>
                      <span className="text-muted-foreground">
                        {dias === 0 ? "creada hoy" : `hace ${dias} día${dias === 1 ? "" : "s"}`}
                      </span>
                      {p.monto_mensual ? (
                        <span className="text-muted-foreground">
                          · ARS {Number(p.monto_mensual).toLocaleString("es-AR")}/mes
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {wa ? (
                      <Button
                        asChild
                        size="sm"
                        className="bg-[#25D366] text-white hover:bg-[#1ebe5b]"
                      >
                        <a href={wa} target="_blank" rel="noopener noreferrer">
                          <MessageCircle className="mr-1 h-4 w-4" /> Seguir
                        </a>
                      </Button>
                    ) : (
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/clientes/${p.id}`}>Abrir</Link>
                      </Button>
                    )}
                    <Button asChild size="sm" variant="outline">
                      <Link href={`/clientes/${p.id}`}>Activar / ver</Link>
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
