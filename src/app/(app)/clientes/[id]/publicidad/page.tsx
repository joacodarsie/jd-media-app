import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Megaphone } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { AdsOnboardingChecklist, type AdsOnboardingState } from "@/components/ads-onboarding-checklist";

export const dynamic = "force-dynamic";

export default async function PublicidadOnboardingPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser();
  const supabase = createClient();
  const admin = createAdmin();

  const { data: client } = await supabase
    .from("clients")
    .select("id, nombre")
    .eq("id", params.id)
    .maybeSingle();
  if (!client) notFound();

  const [{ data: onboarding }, { data: paidSvc }] = await Promise.all([
    admin
      .from("client_ads_onboarding")
      .select(
        "accesos_fb_at, ads_manager_at, dolar_app_at, tarjeta_vinculada_at, campanas_definidas_at, campanas_publicadas_at, campanas_notas, notas"
      )
      .eq("cliente_id", params.id)
      .maybeSingle(),
    admin
      .from("client_services")
      .select("id, activo")
      .eq("cliente_id", params.id)
      .eq("tipo", "paid_media")
      .maybeSingle(),
  ]);

  const state = (onboarding ?? {}) as AdsOnboardingState;
  const tienePauta = !!paidSvc;

  return (
    <div className="space-y-5">
      <div>
        <Link
          href={`/clientes/${client.id}`}
          className="mb-1 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> {client.nombre}
        </Link>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Megaphone className="h-6 w-6 text-primary" /> Onboarding de publicidad
        </h1>
        <p className="text-muted-foreground">
          Los pasos para poner en marcha la pauta de <b>{client.nombre}</b>: accesos,
          administrador de anuncios, Dólar App y las campañas.
        </p>
      </div>

      {!tienePauta && (
        <div className="rounded-lg border border-amber-300 bg-amber-50/50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200">
          Ojo: este cliente todavía no tiene un servicio de <b>pauta (paid media)</b>{" "}
          activo. Podés igual dejar el onboarding listo, pero conviene cargarle el
          servicio en su ficha.
        </div>
      )}

      <AdsOnboardingChecklist clientId={client.id} initial={state} />
    </div>
  );
}
