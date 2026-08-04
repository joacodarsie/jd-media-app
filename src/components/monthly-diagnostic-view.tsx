import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Frown,
  Lightbulb,
  Quote,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  SEMAFORO_LABEL,
  type MonthlyDiagnosticContent,
  type Nivel,
  type Prioridad,
  type Semaforo,
} from "@/lib/monthly-diagnostics/schema";

const SEMAFORO_STYLE: Record<Semaforo, string> = {
  bien: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200",
  atencion:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
  riesgo:
    "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200",
};

const GRAVEDAD_STYLE: Record<Prioridad, string> = {
  alta: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
  media: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  baja: "bg-muted text-muted-foreground",
};

const RIESGO_STYLE: Record<Nivel, string> = {
  alto: "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/40",
  medio: "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40",
  bajo: "border-muted bg-muted/30",
};

const AREA_LABEL: Record<string, string> = {
  diseno: "Diseño",
  community: "Community",
  produccion: "Producción",
  paid: "Paid Media",
  estrategia: "Estrategia",
  desarrollo: "Desarrollo",
  otro: "Coordinación",
};

function Chip({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium",
        className
      )}
    >
      {children}
    </span>
  );
}

function Bloque({
  titulo,
  icon: Icon,
  children,
}: {
  titulo: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Icon className="h-4 w-4" /> {titulo}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">{children}</CardContent>
    </Card>
  );
}

/**
 * Render del diagnóstico mensual. Documento interno: se lee de arriba abajo
 * antes de planificar el mes siguiente.
 *
 * Cada bloque se oculta si no tiene contenido — un mes tranquilo produce un
 * diagnóstico corto, y eso está bien.
 */
export function MonthlyDiagnosticView({
  content,
  mesLabel,
}: {
  content: MonthlyDiagnosticContent;
  mesLabel: string;
}) {
  const c = content;
  const negocio = c.negocio_del_cliente;
  const hayNegocio =
    !!negocio.como_le_fue || negocio.hitos.length > 0 || negocio.lo_que_se_viene.length > 0;

  return (
    <div className="space-y-4">
      {/* Semáforo + resumen: si leés solo esto ya sabés cómo viene la cuenta. */}
      <div className={cn("rounded-lg border p-4", SEMAFORO_STYLE[c.semaforo])}>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
          {c.semaforo === "bien" ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <AlertTriangle className="h-4 w-4" />
          )}
          {SEMAFORO_LABEL[c.semaforo]} · {mesLabel}
        </div>
        {c.resumen.length > 0 && (
          <ul className="mt-2 space-y-1 text-sm">
            {c.resumen.map((b, i) => (
              <li key={i} className="flex gap-2">
                <span className="opacity-60">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Cambio de público: lo que más impacta en la estrategia. Va arriba. */}
      {c.publico_objetivo.hubo_cambio && (
        <div className="rounded-lg border border-violet-300 bg-violet-50 p-4 text-sm dark:border-violet-900 dark:bg-violet-950/40">
          <div className="flex items-center gap-2 font-semibold text-violet-800 dark:text-violet-200">
            <Users className="h-4 w-4" /> Cambió el público objetivo
          </div>
          {c.publico_objetivo.detalle && (
            <p className="mt-1 text-violet-900/90 dark:text-violet-100/90">
              {c.publico_objetivo.detalle}
            </p>
          )}
          {c.publico_objetivo.publico_actual && (
            <p className="mt-2 text-violet-900/90 dark:text-violet-100/90">
              <span className="font-medium">Le hablamos a:</span>{" "}
              {c.publico_objetivo.publico_actual}
            </p>
          )}
        </div>
      )}

      {hayNegocio && (
        <Bloque titulo="Cómo le fue al negocio" icon={Target}>
          {negocio.como_le_fue && <p>{negocio.como_le_fue}</p>}
          {negocio.hitos.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">Hitos del mes</div>
              <ul className="mt-1 space-y-1">
                {negocio.hitos.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {negocio.lo_que_se_viene.length > 0 && (
            <div>
              <div className="text-xs font-medium text-muted-foreground">
                Lo que se viene y tenemos que acompañar
              </div>
              <ul className="mt-1 space-y-1">
                {negocio.lo_que_se_viene.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span>{h}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Bloque>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {c.funciono.length > 0 && (
          <Bloque titulo="Qué funcionó" icon={TrendingUp}>
            {c.funciono.map((p, i) => (
              <div key={i}>
                <div className="font-medium">{p.que}</div>
                {p.por_que && <p className="text-muted-foreground">{p.por_que}</p>}
              </div>
            ))}
          </Bloque>
        )}

        {c.no_funciono.length > 0 && (
          <Bloque titulo="Qué no funcionó" icon={TrendingDown}>
            {c.no_funciono.map((p, i) => (
              <div key={i}>
                <div className="font-medium">{p.que}</div>
                {p.por_que && <p className="text-muted-foreground">{p.por_que}</p>}
              </div>
            ))}
          </Bloque>
        )}
      </div>

      {c.frustraciones.length > 0 && (
        <Bloque titulo="Frustraciones del cliente" icon={Frown}>
          {c.frustraciones.map((f, i) => (
            <div key={i} className="rounded-md border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{f.titulo}</span>
                <Chip className={GRAVEDAD_STYLE[f.gravedad]}>{f.gravedad}</Chip>
                {f.ya_venia_del_mes_pasado && (
                  <Chip className="bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300">
                    ya venía del mes pasado
                  </Chip>
                )}
              </div>
              {f.detalle && <p className="mt-1 text-muted-foreground">{f.detalle}</p>}
            </div>
          ))}
        </Bloque>
      )}

      {c.necesidades.length > 0 && (
        <Bloque titulo="Necesidades que planteó" icon={Lightbulb}>
          {c.necesidades.map((n, i) => (
            <div key={i} className="rounded-md border p-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{n.titulo}</span>
                <Chip className="bg-muted text-muted-foreground">
                  {AREA_LABEL[n.area_sugerida] ?? n.area_sugerida}
                </Chip>
                {n.oportunidad_venta && (
                  <Chip className="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
                    oportunidad de venta
                  </Chip>
                )}
              </div>
              {n.detalle && <p className="mt-1 text-muted-foreground">{n.detalle}</p>}
            </div>
          ))}
        </Bloque>
      )}

      {(c.aprendizajes.length > 0 || c.ajustes_estrategia.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {c.aprendizajes.length > 0 && (
            <Bloque titulo="Lo que aprendimos" icon={Lightbulb}>
              <ul className="space-y-1">
                {c.aprendizajes.map((a, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-muted-foreground">•</span>
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </Bloque>
          )}
          {c.ajustes_estrategia.length > 0 && (
            <Bloque titulo="Qué ajustamos" icon={ArrowRight}>
              {c.ajustes_estrategia.map((p, i) => (
                <div key={i}>
                  <div className="font-medium">{p.que}</div>
                  {p.por_que && <p className="text-muted-foreground">{p.por_que}</p>}
                </div>
              ))}
            </Bloque>
          )}
        </div>
      )}

      {c.riesgo.nivel !== "bajo" && (
        <div className={cn("rounded-lg border p-4 text-sm", RIESGO_STYLE[c.riesgo.nivel])}>
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" /> Riesgo de perder la cuenta: {c.riesgo.nivel}
          </div>
          {c.riesgo.señales.length > 0 && (
            <ul className="mt-2 space-y-1">
              {c.riesgo.señales.map((s, i) => (
                <li key={i} className="flex gap-2">
                  <span className="opacity-60">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {c.citas_del_cliente.length > 0 && (
        <Bloque titulo="Lo que dijo, textual" icon={Quote}>
          {c.citas_del_cliente.map((q, i) => (
            <blockquote
              key={i}
              className="border-l-2 border-muted-foreground/30 pl-3 italic text-muted-foreground"
            >
              “{q}”
            </blockquote>
          ))}
        </Bloque>
      )}
    </div>
  );
}
