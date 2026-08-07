import Link from "next/link";
import { ArrowLeft, FileText } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { opcionesDeRubro } from "@/lib/propuestas/rubros";
import { PropuestasPanel, type PropuestaFila } from "@/components/propuestas-panel";

export const dynamic = "force-dynamic";

const PUEDEN = ["admin", "coordinador", "comercial", "prospecting"];

/**
 * Propuestas comerciales: el documento que se manda cuando un prospecto
 * responde "mandame una propuesta".
 *
 * Va como LINK y no como PDF adjunto por una razón concreta: así sabemos
 * cuándo la abrieron. Con 116 contactados y ninguna señal de quién sigue
 * interesado, saber que Fulano la abrió tres veces vale más que el documento.
 */
export default async function PropuestasPage() {
  const me = await requireUser();
  if (!userInRoles(me, PUEDEN)) redirect("/prospeccion");

  const admin = createAdmin();
  const { data, error } = await admin
    .from("proposals")
    .select(
      "id, token, empresa, contacto_nombre, rubro_slug, rubro_texto, pack_sugerido, ia, aperturas, primera_apertura_at, ultima_apertura_at, created_at, creada_por_id",
    )
    .order("created_at", { ascending: false })
    .limit(200);

  const faltaMigracion = error?.code === "42P01";

  const { data: packsRaw } = await admin
    .from("agency_packs")
    .select("slug, nombre, precio_mensual, orden")
    .order("orden");

  const filas: PropuestaFila[] = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: String(r.id),
    token: String(r.token),
    empresa: String(r.empresa),
    contactoNombre: (r.contacto_nombre as string | null) ?? null,
    rubroSlug: (r.rubro_slug as string | null) ?? null,
    rubroTexto: (r.rubro_texto as string | null) ?? null,
    packSugerido: (r.pack_sugerido as string | null) ?? null,
    personalizada: !!(r.ia as { diagnostico?: string } | null)?.diagnostico,
    aperturas: Number(r.aperturas ?? 0),
    ultimaApertura: (r.ultima_apertura_at as string | null) ?? null,
    creadaEl: String(r.created_at),
  }));

  return (
    <div className="space-y-5">
      <Link
        href="/prospeccion"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Prospección
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <FileText className="h-6 w-6 text-primary" /> Propuestas
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Cuando alguien te dice <b>&quot;mandame una propuesta&quot;</b>, armás el link
          acá y se lo pasás por WhatsApp. El documento sale con los servicios y los
          precios de <b>jdmedia.com.ar</b> (se sincronizan solos), y con ideas del
          rubro del prospecto. <b>Te avisa cuándo la abrieron.</b>
        </p>
      </div>

      {faltaMigracion ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          Falta aplicar la <b>migración 0153</b> en Supabase para poder guardar
          propuestas.
        </div>
      ) : (
        <PropuestasPanel
          filas={filas}
          rubros={opcionesDeRubro()}
          packs={((packsRaw ?? []) as { slug: string; nombre: string }[]).map((p) => ({
            slug: p.slug,
            nombre: p.nombre,
          }))}
        />
      )}
    </div>
  );
}
