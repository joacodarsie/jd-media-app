import Link from "next/link";
import { PAY_FREQUENCY_LABEL } from "@/lib/constants";
import type { Compensation, Position } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function CompensationCard({
  compensation,
  position,
  showSource = true,
}: {
  compensation: Compensation | null;
  position: Pick<
    Position,
    | "id"
    | "nombre"
    | "pago_default_monto"
    | "pago_default_moneda"
    | "pago_default_frecuencia"
    | "pago_default_forma"
    | "pago_default_notas"
  > | null;
  showSource?: boolean;
}) {
  const usingOverride = !!compensation;
  const effective = compensation ?? {
    monto: position?.pago_default_monto ?? null,
    moneda: position?.pago_default_moneda ?? "ARS",
    frecuencia: position?.pago_default_frecuencia ?? null,
    forma_pago: position?.pago_default_forma ?? null,
    notas: position?.pago_default_notas ?? null,
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Compensación</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {effective.monto == null ? (
          <p className="text-muted-foreground">
            Sin compensación cargada todavía.
            {position && (
              <>
                {" "}
                El puesto{" "}
                <Link
                  href={`/equipo/${position.id}`}
                  className="font-medium underline"
                >
                  {position.nombre}
                </Link>{" "}
                tampoco tiene un pago por defecto.
              </>
            )}
          </p>
        ) : (
          <>
            <div className="text-xl font-semibold">
              {effective.moneda}{" "}
              {Number(effective.monto).toLocaleString("es-AR")}
              {effective.frecuencia && (
                <span className="ml-1 text-xs font-normal text-muted-foreground">
                  · {PAY_FREQUENCY_LABEL[effective.frecuencia]}
                </span>
              )}
            </div>
            {effective.forma_pago && (
              <div className="text-muted-foreground">{effective.forma_pago}</div>
            )}
            {effective.notas && (
              <div className="whitespace-pre-line text-xs text-muted-foreground">
                {effective.notas}
              </div>
            )}
            {showSource && (
              <p className="pt-1 text-xs text-muted-foreground">
                {usingOverride
                  ? "Override individual."
                  : position
                  ? `Heredado del puesto ${position.nombre}.`
                  : "Sin puesto asignado."}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
