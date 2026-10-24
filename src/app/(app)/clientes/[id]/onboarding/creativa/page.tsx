import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { cerrarTareaDePanel } from "@/lib/onboarding/tareas-paneles-run";
import { hoyYmd } from "@/lib/dates";
import { loadOnboarding } from "../_shared";
import { OnboardingTabs } from "@/components/onboarding-tabs";
import { OnboardingCamino } from "@/components/onboarding-camino";
import { panelesVisibles } from "@/lib/onboarding/paneles";
import { cargarCuentasCreativas } from "@/lib/creativa/cargar";
import { ENTREGABLES_ONBOARDING } from "@/lib/creativa/creativa";
import { CreativaDefinicion } from "@/components/creativa-definicion";
import { CreativaDocumentos } from "@/components/creativa-documentos";

export const dynamic = "force-dynamic";

/**
 * Onboarding creativo (23/10/2026): lo que hace la dirección creativa al
 * arrancar una cuenta. Cuatro definiciones (identidad, tono, importancia de
 * cada medio y urgencia) y tres entregables (plataforma de campaña, estrategia
 * de redes y documento técnico), que quedan en el Área Creativa.
 */
export default async function OnboardingCreativaPage({ params }: { params: { id: string } }) {
  const me = await requireRole(["admin", "coordinador", "coordinador_diseno"]);
  const data = await loadOnboarding(params.id);
  if (!data) notFound();
  const { client, services } = data;
  const paneles = panelesVisibles([me.rol, me.rol_secundario], {
    gestionRedes: services.some((s) => s.tipo === "gestion_redes"),
    disenoGrafico: services.some((s) => s.tipo === "diseno_grafico"),
    paidMedia: services.some((s) => s.tipo === "paid_media"),
  });
  const [c] = await cargarCuentasCreativas(createAdmin(), hoyYmd(), params.id);
  if (!c) notFound();
  const hechos = c.pasos.filter((p) => p.hecho).length;
  // Si la pestaña quedó completa, su tarea se cierra sola (24/10/2026).
  if (hechos === c.pasos.length) await cerrarTareaDePanel(createAdmin(), client.id, "creativa");
  const entregables = c.docs.filter((d) => (ENTREGABLES_ONBOARDING as string[]).includes(d.entregable));

  return (
    <div className="space-y-5">
      <Link href={`/clientes/${client.id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al cliente
      </Link>

      <OnboardingTabs clienteId={client.id} clienteNombre={client.nombre} paneles={paneles} actual="creativa" />

      <OnboardingCamino pasos={c.pasos.map((p) => ({ key: p.clave, titulo: p.titulo, hecho: p.hecho, fecha: null }))} />

      <div>
        <div className="text-xs uppercase tracking-wide text-muted-foreground">Onboarding · Dirección creativa</div>
        <h1 className="mt-1 text-2xl font-bold">{client.nombre}</h1>
        <p className="text-muted-foreground">
          {hechos}/{c.pasos.length} pasos · {Math.round((hechos / c.pasos.length) * 100)}%
        </p>
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-4 md:p-5">
        <div>
          <h2 className="font-semibold">1 · Las definiciones</h2>
          <p className="text-xs text-muted-foreground">Identidad y tono de la marca, cuánto pesa cada medio y qué tan urgente es su comunicación: no todas las marcas están igual de apuradas por vender.</p>
        </div>
        <CreativaDefinicion clienteId={client.id} inicial={c.definicion} />
      </section>

      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">2 · Los entregables</h2>
          <p className="text-xs text-muted-foreground">
            La plataforma de campaña (el documento donde se escribe todo), la estrategia de redes y el documento técnico. Quedan en el{" "}
            <Link href={`/creativa/${client.id}`} className="underline underline-offset-2">
              Área Creativa
            </Link>{" "}
            con su vigencia, y JDmedIA los usa para armar los calendarios.
          </p>
        </div>
        <CreativaDocumentos clienteId={client.id} docs={entregables} tipos={ENTREGABLES_ONBOARDING} />
      </section>
    </div>
  );
}
