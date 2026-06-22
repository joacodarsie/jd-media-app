import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Megaphone, TrendingUp, BarChart3 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { AdsOnboardingChecklist, type AdsOnboardingState } from "@/components/ads-onboarding-checklist";
import { ClientListEditor } from "@/components/client-list-editor";
import { MetaAdAccountField } from "@/components/meta-ad-account-field";
import { JdMediaPartnerCard } from "@/components/jdmedia-partner-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

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
    .select("id, nombre, credenciales")
    .eq("id", params.id)
    .maybeSingle();
  if (!client) notFound();

  const credenciales =
    ((client as unknown as { credenciales?: Record<string, string>[] }).credenciales ??
      []) as Record<string, string>[];

  const [{ data: onboarding }, { data: paidSvc }] = await Promise.all([
    admin
      .from("client_ads_onboarding")
      .select(
        "accesos_fb_at, pagina_fb_at, socio_business_at, ads_manager_at, su_adaccount_at, su_pagina_at, su_ig_at, dolar_app_at, tarjeta_vinculada_at, campanas_definidas_at, campanas_publicadas_at, campanas_notas, notas, meta_ad_account_id"
      )
      .eq("cliente_id", params.id)
      .maybeSingle(),
    admin
      .from("client_services")
      .select("id, tipo")
      .eq("cliente_id", params.id)
      .in("tipo", ["paid_media", "gestion_redes"])
      .eq("activo", true),
  ]);

  const onb = (onboarding ?? {}) as AdsOnboardingState & {
    meta_ad_account_id?: string | null;
  };
  const state = onb as AdsOnboardingState;
  const adAccountId = onb.meta_ad_account_id ?? null;
  // Gestión de redes ya incluye el paid media básico en Meta Ads.
  const tienePauta = ((paidSvc ?? []) as unknown[]).length > 0;

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

      <JdMediaPartnerCard />

      <AdsOnboardingChecklist clientId={client.id} initial={state} />

      {/* Conexión con Paid Media */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4 text-primary" /> Conexión con Paid Media
          </CardTitle>
          <p className="text-xs text-muted-foreground">
            Cargá el <b>ID de la cuenta publicitaria</b> de Meta del cliente
            (<code>act_XXXX</code>). Con esto, la sección Paid Media trae las
            métricas diarias y el análisis con IA de esta cuenta.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <MetaAdAccountField clientId={client.id} initial={adAccountId} />
          <p className="text-[11px] text-muted-foreground">
            Lo encontrás en el Administrador de anuncios de Meta, arriba a la
            izquierda (ej: <code>act_1234567890</code>). Es opcional, pero deja
            todo listo para medir desde el día uno.
          </p>
          <Link
            href="/paid-media"
            className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-xs font-medium transition hover:border-primary/40 hover:bg-muted"
          >
            <BarChart3 className="h-3.5 w-3.5 text-primary" /> Ir a Paid Media
          </Link>
        </CardContent>
      </Card>

      {/* La conexión de Instagram y TikTok vive ahora en el onboarding de
          Gestión de Redes (resultados orgánicos), no acá. */}
      <div className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
        ¿Buscás conectar <b>Instagram</b> o <b>TikTok</b> del cliente? Eso ahora
        se hace en el{" "}
        <Link
          href={`/clientes/${client.id}/onboarding/redes`}
          className="font-medium text-primary underline underline-offset-2"
        >
          onboarding de Gestión de Redes
        </Link>
        . Acá, en publicidad, solo va la conexión con Meta Ads.
      </div>

      <Card>
        <CardContent className="pt-4">
          <ClientListEditor
            clientId={client.id}
            field="credenciales"
            title="Accesos del cliente"
            description="Credenciales de las plataformas (Meta, Facebook, Google…) para volver a loguearte cuando haga falta. Es la misma lista que figura en la ficha del cliente."
            addLabel="Agregar acceso"
            initial={credenciales}
            itemFields={[
              { name: "servicio", label: "Servicio", placeholder: "Ej: Meta Business" },
              { name: "url", label: "URL (opcional)", type: "url", placeholder: "https://business.facebook.com" },
              { name: "usuario", label: "Usuario / Email" },
              { name: "password", label: "Contraseña", type: "password" },
              { name: "notas", label: "Notas (opcional)" },
            ]}
          />
        </CardContent>
      </Card>
    </div>
  );
}
