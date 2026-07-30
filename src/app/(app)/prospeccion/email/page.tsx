import Link from "next/link";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { coldEmailConfig } from "@/lib/email/cold-sender";
import { diasParaCubrir, topeDelDia } from "@/lib/prospecting/cold-email";
import { ColdEmailPanel, type CampanaEmail } from "@/components/cold-email-panel";

export const dynamic = "force-dynamic";

const ROLES_OK = ["admin", "coordinador", "comercial", "prospecting"];

export default async function ColdEmailPage() {
  const me = await requireUser();
  if (!userInRoles(me, ROLES_OK)) {
    return (
      <p className="text-sm text-muted-foreground">
        Esta sección es del equipo comercial.
      </p>
    );
  }

  const cfg = coldEmailConfig();
  const admin = createAdmin();

  const [{ data: campaigns }, contactosRes, sendsRes, bajasRes] = await Promise.all([
    admin
      .from("prospecting_campaigns")
      .select("id, nombre, rubro, mensajes_plantilla")
      .order("created_at", { ascending: false }),
    admin.from("prospecting_contacts").select("campaign_id, email, sitio_web, estado"),
    admin.from("cold_email_sends").select("campaign_id, email, estado, enviado_at, asunto"),
    admin.from("cold_email_optouts").select("email"),
  ]);

  // Si falta la migración, la pantalla igual explica qué hacer en vez de romper.
  const faltaMigracion =
    (sendsRes.error as { code?: string } | null)?.code === "42P01" ||
    (contactosRes.error as { code?: string } | null)?.code === "42703";

  const contactos = (contactosRes.data ?? []) as {
    campaign_id: string;
    email: string | null;
    sitio_web: string | null;
    estado: string | null;
  }[];
  const sends = (sendsRes.data ?? []) as {
    campaign_id: string | null;
    email: string;
    estado: string;
    enviado_at: string | null;
    asunto: string;
  }[];
  const bajas = (bajasRes.data ?? []) as { email: string }[];

  const campanas: CampanaEmail[] = ((campaigns ?? []) as {
    id: string;
    nombre: string;
    rubro: string;
    mensajes_plantilla: unknown;
  }[]).map((c) => {
    const propios = contactos.filter((x) => x.campaign_id === c.id);
    const misSends = sends.filter((s) => s.campaign_id === c.id);
    return {
      id: c.id,
      nombre: c.nombre,
      contactos: propios.length,
      conEmail: propios.filter((x) => x.email).length,
      sinEmailConWeb: propios.filter((x) => !x.email && x.sitio_web).length,
      sinNada: propios.filter((x) => !x.email && !x.sitio_web).length,
      enCola: misSends.filter((s) => s.estado === "pendiente").length,
      enviados: misSends.filter((s) => s.estado === "enviado").length,
      tieneMensaje: !!c.mensajes_plantilla,
    };
  });

  const enviadosTotal = sends.filter((s) => s.estado === "enviado").length;
  const enCola = sends.filter((s) => s.estado === "pendiente").length;
  const conError = sends.filter((s) => s.estado === "error").length;
  const hoy = new Date().toISOString().slice(0, 10);
  const enviadosHoy = sends.filter(
    (s) => s.estado === "enviado" && s.enviado_at?.slice(0, 10) === hoy
  ).length;
  const topeHoy = topeDelDia(enviadosTotal, cfg.topeDiario);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Email en frío</h1>
        <p className="text-muted-foreground">
          El único canal que se puede mandar solo sin arriesgar el WhatsApp de la
          agencia. Sale un lote por día, de lunes a viernes, y sube de a poco.
        </p>
      </div>

      {faltaMigracion && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
          <b>Falta aplicar la migración 0142.</b> Pegá{" "}
          <code>supabase/migrations/0142_cold_email.sql</code> en el SQL Editor de
          Supabase y recargá. Hasta entonces esta pantalla no puede guardar nada.
        </div>
      )}

      {!cfg.configurado && (
        <div className="rounded-xl border border-sky-300 bg-sky-50 p-4 text-sm dark:border-sky-500/40 dark:bg-sky-500/10">
          <p className="font-semibold">Todavía no manda nada. Falta conectar el correo:</p>
          <ol className="ml-4 mt-2 list-decimal space-y-1 text-xs">
            <li>
              Creá una cuenta gratis en <b>resend.com</b> (3.000 mails por mes sin
              costo).
            </li>
            <li>
              Agregá un <b>dominio aparte</b> del principal (ej.{" "}
              <code>jdmedia.com.ar</code>). Es importante: si el frío quema la
              reputación, no querés que se lleve puesto el mail con el que hablás
              con tus clientes.
            </li>
            <li>Cargá los 3 registros DNS que te da Resend y esperá el ✅ verde.</li>
            <li>
              En Vercel → Settings → Environment Variables, agregá:
              <ul className="ml-4 mt-1 list-disc">
                {cfg.faltan.map((f) => (
                  <li key={f}>
                    <code>{f}</code>
                  </li>
                ))}
                <li>
                  <code>COLD_EMAIL_REPLY_TO</code> — tu mail real, para que las
                  respuestas te lleguen a la casilla de siempre (opcional pero
                  recomendado).
                </li>
                <li>
                  <code>COLD_EMAIL_DIRECCION</code> — dirección o ciudad de la
                  agencia. Va en el pie: es requisito del email comercial.
                </li>
              </ul>
            </li>
          </ol>
          <p className="mt-2 text-xs text-muted-foreground">
            Mientras tanto podés buscar los emails y armar la cola: cuando conectes
            el dominio, sale todo solo.
          </p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <Stat label="Enviados" valor={enviadosTotal} />
        <Stat label="Hoy" valor={`${enviadosHoy} / ${topeHoy}`} />
        <Stat label="En cola" valor={enCola} />
        <Stat label="Con error" valor={conError} />
        <Stat label="Bajas" valor={bajas.length} />
      </div>

      {enCola > 0 && (
        <p className="text-xs text-muted-foreground">
          A este ritmo la cola de {enCola} tarda{" "}
          <b>{diasParaCubrir(enCola, cfg.topeDiario)} días hábiles</b> en salir. El
          volumen arranca en 25 por día y sube solo: un dominio nuevo que manda
          cientos el primer día se va derecho a spam.
        </p>
      )}

      <ColdEmailPanel
        campanas={campanas}
        configurado={cfg.configurado}
        puedeMandar={userInRoles(me, ["admin", "coordinador"])}
      />

      <p className="text-xs text-muted-foreground">
        ¿Alguien pidió que no le escribamos más? Se da de baja solo con el link del
        mail, pero también podés cargarlo a mano desde acá.{" "}
        <Link href="/prospeccion" className="underline">
          Volver a prospección
        </Link>
      </p>
    </div>
  );
}

function Stat({ label, valor }: { label: string; valor: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold tabular-nums">{valor}</p>
    </div>
  );
}
