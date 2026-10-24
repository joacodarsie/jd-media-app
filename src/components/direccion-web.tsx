import { Globe } from "lucide-react";
import { BloquePlegable } from "@/components/bloque-plegable";
import { createAdmin } from "@/lib/supabase/admin";
import { resumirWeb, variacion, type EventoWeb } from "@/lib/web/embudo";
import { cn } from "@/lib/utils";

/**
 * "La web esta semana", en Dirección (13/10/2026): si jdmedia.com.ar trae
 * clientes o es solo una vidriera. Últimos 7 días contra los 7 anteriores.
 */
export async function DireccionWeb() {
  const ahora = Date.now();
  const hace7 = new Date(ahora - 7 * 86_400_000).toISOString();
  const hace14 = new Date(ahora - 14 * 86_400_000).toISOString();
  const { data, error } = await createAdmin()
    .from("web_eventos")
    .select("tipo, fuente, created_at")
    .gte("created_at", hace14)
    .limit(20000);
  if (error) return null;
  const eventos = (data ?? []) as EventoWeb[];
  const esta = resumirWeb(eventos.filter((e) => e.created_at >= hace7));
  const antes = resumirWeb(eventos.filter((e) => e.created_at < hace7));
  const max = Math.max(1, ...esta.fuentes.map((f) => f.visitas));

  const Dato = ({ label, valor, ant, ayuda }: { label: string; valor: number; ant: number; ayuda: string }) => {
    const v = variacion(valor, ant);
    return (
      <div className="rounded-lg border bg-background p-3">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5 flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">{valor}</span>
          {v && (
            <span
              className={cn(
                "text-xs font-medium",
                v.startsWith("▲") || v === "nuevo" ? "text-emerald-600" : v.startsWith("▼") ? "text-red-600" : "text-muted-foreground"
              )}
            >
              {v}
            </span>
          )}
        </div>
        <div className="mt-1 text-[11px] leading-snug text-muted-foreground">{ayuda}</div>
      </div>
    );
  };

  return (
    <BloquePlegable
      id="web"
      pegado
      emoji={<Globe className="h-5 w-5 text-primary" />}
      titulo="La web esta semana"
      resumen={`${esta.visitas} visitas · ${esta.whatsapp} escribieron por WhatsApp · ${esta.diagnosticos} diagnósticos`}
    >
      {esta.visitas === 0 && antes.visitas === 0 ? (
        <p className="px-4 py-4 text-sm text-muted-foreground">
          Todavía no hay datos: la web empezó a contar el 13/10/2026. En unos días se llena.
        </p>
      ) : (
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Dato label="Visitas" valor={esta.visitas} ant={antes.visitas} ayuda="Gente que entró a jdmedia.com.ar (una por visita)." />
            <Dato label="Escribieron por WhatsApp" valor={esta.whatsapp} ant={antes.whatsapp} ayuda="Tocaron un botón de WhatsApp: son las consultas que trae la web." />
            <Dato label="Pidieron el diagnóstico de Instagram" valor={esta.diagnosticos} ant={antes.diagnosticos} ayuda="Pusieron su usuario en el diagnóstico gratis de la home." />
            <Dato label="Mandaron el formulario" valor={esta.formularios} ant={antes.formularios} ayuda="Completaron el formulario de contacto (después sigue por WhatsApp)." />
            <Dato label="Descargaron un recurso" valor={esta.recursos} ant={antes.recursos} ayuda="Dejaron su mail para bajarse algo: entran solos a Comercial." />
            <Dato label="Fueron a dejar reseña" valor={esta.resenas} ant={antes.resenas} ayuda="Tocaron «Dejanos tu reseña» (lo de Google se ve en el perfil)." />
          </div>
          <p className="text-sm">
            {esta.tasa === null ? (
              <span className="text-muted-foreground">Sin visitas esta semana.</span>
            ) : (
              <>
                De cada 100 personas que entran, <b>{esta.tasa.toString().replace(".", ",")}</b> escriben por WhatsApp.{" "}
                <span className="text-muted-foreground">
                  En una web de servicios, entre 2 y 5 está bien; menos de 1 quiere decir que la web no convence.
                </span>
              </>
            )}
          </p>
          {esta.fuentes.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">De dónde vienen</p>
              <ul className="space-y-1">
                {esta.fuentes.map((f) => (
                  <li key={f.fuente} className="flex items-center gap-2 text-sm">
                    <span className="w-28 shrink-0 truncate">{f.fuente}</span>
                    <span className="h-2 rounded-full bg-primary" style={{ width: `${(f.visitas / max) * 60}%` }} />
                    <span className="text-xs tabular-nums text-muted-foreground">{f.visitas}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </BloquePlegable>
  );
}
