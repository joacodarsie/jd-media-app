import { AtSign, Music2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { IgConnect } from "@/components/ig-connect";
import { TiktokConnect } from "@/components/tiktok-connect";

/**
 * Tarjeta del onboarding de Gestión de Redes: conexión de Instagram y TikTok con
 * el paso a paso detallado, para que los resultados orgánicos entren solos al
 * reporte mensual. Es server component; los widgets de conexión son client.
 */
export function RedesConnectionGuide({
  clientId,
  igConnected,
  igUsername,
  tiktokOn,
  ttConnected,
  ttUsername,
}: {
  clientId: string;
  igConnected: boolean;
  igUsername: string | null;
  tiktokOn: boolean;
  ttConnected: boolean;
  ttUsername: string | null;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Conexión de redes
        </div>
        <CardTitle className="text-base">Vincular Instagram y TikTok</CardTitle>
        <p className="text-xs text-muted-foreground">
          Dejá conectadas las cuentas del cliente para que los{" "}
          <b>resultados orgánicos</b> (seguidores, alcance, interacciones)
          aparezcan <b>solos</b> en el reporte mensual. Seguí el paso a paso de
          cada red.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* ── Instagram ── */}
        <section className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <AtSign className="h-4 w-4 text-primary" /> Instagram
          </h3>
          <ol className="ml-1 space-y-1.5 text-sm text-muted-foreground">
            <Step n={1}>
              La cuenta del cliente tiene que ser <b>profesional</b> (Business o
              Creator). En Instagram: <i>Configuración y privacidad → Cuenta →
              Cambiar a cuenta profesional</i>.
            </Step>
            <Step n={2}>
              Esa cuenta de Instagram tiene que estar <b>vinculada a una página de
              Facebook</b> del cliente. (Desde la página de FB:{" "}
              <i>Configuración → Cuentas vinculadas → Instagram</i>.)
            </Step>
            <Step n={3}>
              Pedile al cliente que <b>comparta la página de Facebook con JD Media</b>:
              en <i>Meta Business Suite → Configuración → Usuarios / Activos</i>,
              agregando el Business de JD Media como socio (o dándote acceso de
              administrador a la página).
            </Step>
            <Step n={4}>
              En el <b>Business de JD Media</b> (business.facebook.com →
              Configuración del negocio), asigná esa página al{" "}
              <b>usuario del sistema <code>jdmedia</code></b> con permisos de
              Instagram.
            </Step>
            <Step n={5}>
              Acá abajo tocá <b>&ldquo;Detectar cuentas&rdquo;</b> y elegí la del
              cliente. Si no aparece, revisá los pasos 3 y 4 — o pegá el{" "}
              <b>ID numérico</b> de la cuenta a mano.
            </Step>
            <Step n={6}>
              Tiene que quedar <b>&ldquo;Conectado @usuario&rdquo;</b>. Listo.
            </Step>
          </ol>
          <IgConnect clientId={clientId} connected={igConnected} username={igUsername} />
        </section>

        {/* ── TikTok ── */}
        <section className="space-y-3 border-t pt-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Music2 className="h-4 w-4 text-primary" /> TikTok
          </h3>
          <ol className="ml-1 space-y-1.5 text-sm text-muted-foreground">
            <Step n={1}>
              La cuenta de TikTok del cliente tiene que ser <b>Business o Creator</b>{" "}
              (no personal).
            </Step>
            <Step n={2}>
              Tocá <b>&ldquo;Conectar ahora&rdquo;</b> si estás con el cliente, o{" "}
              <b>&ldquo;Copiar link para el cliente&rdquo;</b> y mandáselo por
              WhatsApp.
            </Step>
            <Step n={3}>
              El cliente abre el link, <b>inicia sesión en su propia cuenta de
              TikTok</b> y acepta los permisos que pide la pantalla.
            </Step>
            <Step n={4}>
              Tiene que quedar <b>&ldquo;Conectado @usuario&rdquo;</b>.
            </Step>
          </ol>
          {tiktokOn ? (
            <TiktokConnect clientId={clientId} connected={ttConnected} username={ttUsername} />
          ) : (
            <p className="rounded-lg border border-dashed bg-muted/20 p-3 text-xs text-muted-foreground">
              La conexión de TikTok todavía <b>no está habilitada</b> en la app
              (falta aprobar la integración). Cuando esté lista, acá va a aparecer
              el botón para conectar la cuenta.
            </p>
          )}
        </section>
      </CardContent>
    </Card>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
        {n}
      </span>
      <span className="leading-relaxed">{children}</span>
    </li>
  );
}
