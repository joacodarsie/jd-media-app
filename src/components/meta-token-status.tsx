import { AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { checkMetaToken } from "@/lib/meta/health";

/**
 * Estado del token de Meta (server component). Verde si todo OK, ámbar si le
 * faltan permisos o está por vencer, rojo si dejó de funcionar.
 */
export async function MetaTokenStatus() {
  const s = await checkMetaToken();
  if (!s.configured) return null; // sin token la página ya muestra otro aviso

  const venceProto = s.daysToExpiry != null && s.daysToExpiry <= 7;
  const faltanScopes = (s.missing?.length ?? 0) > 0;

  // Rojo: el token no funciona.
  if (!s.ok) {
    return (
      <Banner tone="red" icon={ShieldAlert}>
        <b>Meta desconectado:</b> {s.error ?? "el token dejó de funcionar."} Regeneralo en
        Business Settings, si no Paid Media y Resultados no traen datos.
      </Banner>
    );
  }

  // Ámbar: anda pero le falta algo.
  if (venceProto || faltanScopes) {
    return (
      <Banner tone="amber" icon={AlertTriangle}>
        <b>Meta conectado con observaciones:</b>{" "}
        {venceProto && <>el token vence en {s.daysToExpiry} días. </>}
        {faltanScopes && (
          <>Faltan permisos: <code>{s.missing!.join(", ")}</code> (Instagram no va a andar hasta sumarlos).</>
        )}
      </Banner>
    );
  }

  // Verde: todo OK.
  return (
    <Banner tone="green" icon={CheckCircle2}>
      <b>Meta conectado.</b>{" "}
      {s.daysToExpiry != null ? `El token vence en ${s.daysToExpiry} días.` : "Token sin vencimiento."}
    </Banner>
  );
}

function Banner({
  tone,
  icon: Icon,
  children,
}: {
  tone: "green" | "amber" | "red";
  icon: typeof CheckCircle2;
  children: React.ReactNode;
}) {
  const styles = {
    green:
      "border-emerald-300 bg-emerald-50/50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-200",
    amber:
      "border-amber-300 bg-amber-50/50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-200",
    red: "border-red-300 bg-red-50/50 text-red-800 dark:border-red-900 dark:bg-red-950/20 dark:text-red-200",
  }[tone];
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-xs ${styles}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{children}</span>
    </div>
  );
}
