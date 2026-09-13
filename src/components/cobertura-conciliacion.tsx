import Link from "next/link";
import { AtSign, EyeOff } from "lucide-react";

/**
 * Sobre cuánta cartera está hablando esta pantalla.
 *
 * "¿Salió de verdad?" solo puede mirar las cuentas con Instagram conectado, y
 * sin decirlo el número engaña: al 13/9/2026 eran 6 de 12 cuentas activas, así
 * que de la mitad de la cartera la app no sabe —ni puede saber— si el contenido
 * salió. Esa mitad invisible es la que hacía que "162 piezas sin producir" no
 * significara nada.
 *
 * Las historias tampoco se pueden verificar: la API de Instagram solo expone
 * las de las últimas 24 horas. Conviene decirlo acá y no en una nota al pie.
 */
export function CoberturaConciliacion({
  conectadas,
  sinConectar,
}: {
  conectadas: number;
  /** Nombres de las cuentas activas que todavía no dieron acceso. */
  sinConectar: string[];
}) {
  const total = conectadas + sinConectar.length;
  if (total === 0) return null;

  return (
    <div className="space-y-2 rounded-xl border bg-muted/30 p-4 text-sm">
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <AtSign className="h-4 w-4 text-primary" />
        Esta pantalla mira{" "}
        <b>
          {conectadas} de {total} cuentas activas
        </b>
        <span className="text-muted-foreground">
          — las que tienen Instagram conectado.
        </span>
      </p>

      {sinConectar.length > 0 && (
        <p className="flex flex-wrap items-start gap-x-2 gap-y-1 text-muted-foreground">
          <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <span>
            De {sinConectar.length === 1 ? "esta cuenta" : "estas"} la app{" "}
            <b className="text-foreground">no puede saber</b> si el contenido salió:{" "}
            {sinConectar.join(" · ")}.{" "}
            <Link href="/clientes/conectar-instagram" className="underline">
              Conectar Instagram
            </Link>
            {" "}— lo tiene que autorizar el cliente.
          </span>
        </p>
      )}

      <p className="text-xs text-muted-foreground">
        Las <b>historias</b> no entran en esta comparación: Instagram solo deja ver las
        de las últimas 24 horas, así que nunca aparecerían como publicadas.
      </p>
    </div>
  );
}
