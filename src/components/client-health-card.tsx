import { Activity, CheckCircle2, AlertTriangle, Star } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AccountHealth } from "@/lib/director/health";
import { ClientQualityActions } from "@/components/client-quality-actions";

const SEMAFORO = {
  bien: { label: "Bien", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  regular: { label: "A vigilar", dot: "bg-amber-500", text: "text-amber-700 dark:text-amber-400" },
  mal: { label: "Necesita atención", dot: "bg-rose-500", text: "text-rose-700 dark:text-rose-400" },
} as const;

/**
 * Tarjeta "Estado del servicio" en la ficha del cliente: el mismo semáforo del
 * Director, pero para esta cuenta puntual. Cruza cumplimiento del plan,
 * crecimiento de IG, tareas vencidas, cambios pedidos y actividad del cliente.
 */
export function ClientHealthCard({
  health,
  clienteId,
  periodo,
  portalToken,
}: {
  health: AccountHealth;
  clienteId: string;
  periodo: string;
  portalToken: string | null;
}) {
  const s = SEMAFORO[health.semaforo];
  const metrics: { label: string; value: string }[] = [];
  if (health.planMeta > 0)
    metrics.push({ label: "Plan del mes", value: `${health.planHechas}/${health.planMeta} piezas` });
  if (health.igConectado && health.igDelta != null)
    metrics.push({
      label: "Instagram (35 días)",
      value: `${health.igDelta >= 0 ? "+" : ""}${health.igDelta} seguidores`,
    });
  if (health.tareasVencidas > 0)
    metrics.push({ label: "Tareas vencidas", value: `${health.tareasVencidas}` });
  if (health.cambiosPedidos > 0)
    metrics.push({ label: "Cambios pedidos (mes)", value: `${health.cambiosPedidos}` });
  if (health.portalDiasSinVer != null)
    metrics.push({
      label: "Vio el portal",
      value:
        health.portalDiasSinVer === 0 ? "hoy" : `hace ${health.portalDiasSinVer} día${health.portalDiasSinVer === 1 ? "" : "s"}`,
    });

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="h-4 w-4 text-primary" /> Estado del servicio
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${s.dot}`} />
            <span className={`font-semibold ${s.text}`}>{s.label}</span>
          </div>
          {health.satisfaccion != null && (
            <span
              className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium"
              title={`Calificación del cliente${health.satisfaccionPeriodo ? ` (${health.satisfaccionPeriodo})` : ""}`}
            >
              <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
              {health.satisfaccion}/5
            </span>
          )}
        </div>

        {metrics.length > 0 && (
          <div className="space-y-1">
            {metrics.map((m) => (
              <div key={m.label} className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">{m.label}</span>
                <span className="font-medium">{m.value}</span>
              </div>
            ))}
          </div>
        )}

        {health.alertas.length > 0 && (
          <ul className="space-y-1">
            {health.alertas.map((a, i) => (
              <li key={i} className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a}
              </li>
            ))}
          </ul>
        )}
        {health.buenas.length > 0 && (
          <ul className="space-y-1">
            {health.buenas.map((b, i) => (
              <li key={i} className="flex items-start gap-1.5 text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {b}
              </li>
            ))}
          </ul>
        )}

        <ClientQualityActions
          clienteId={clienteId}
          periodo={periodo}
          reunionHecha={health.reunionHecha}
          portalToken={portalToken}
        />
      </CardContent>
    </Card>
  );
}
