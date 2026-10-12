import Link from "next/link";
import { CalendarHeart } from "lucide-react";
import { createAdmin } from "@/lib/supabase/admin";
import { userInRoles } from "@/lib/auth";
import { hoyYmd } from "@/lib/dates";
import { sumarDias } from "@/lib/retencion/onboarding-15";
import { cuentasQueAplican, diasHasta, efemeridesEntre, type Efemeride } from "@/lib/efemerides/argentina";
import { cn } from "@/lib/utils";

const DOW = ["dom", "lun", "mar", "mié", "jue", "vie", "sáb"];

export function fechaLarga(ymd: string) {
  const d = new Date(`${ymd}T12:00:00Z`);
  return `${DOW[d.getUTCDay()]} ${ymd.slice(8, 10)}/${ymd.slice(5, 7)}`;
}

export function enCuanto(dias: number) {
  if (dias === 0) return "hoy";
  if (dias === 1) return "mañana";
  return `en ${dias} días`;
}

/**
 * "Fechas que se vienen" en Mi día: las efemérides de los próximos 30 días.
 *
 * Pedido del dueño (12/10/2026): que se avise con tiempo para que entren en el
 * calendario. La ven quienes arman calendarios (CM, coordinación, dirección).
 * Las de rubro solo aparecen si a alguna de SUS cuentas le sirve; las de todas
 * las cuentas, siempre.
 */
export async function EfemeridesProximas({
  user,
}: {
  user: { id: string; rol: string; rol_secundario?: string | null };
}) {
  const admin = createAdmin();
  const esStaff = userInRoles(user, ["admin", "coordinador", "coordinador_diseno"]);
  let q = admin.from("clients").select("id, nombre, rubro").eq("estado", "activo").eq("es_interno", false);
  if (!esStaff) q = q.eq("cm_id", user.id);
  const { data } = await q;
  const cuentas = (data ?? []) as { id: string; nombre: string; rubro: string | null }[];
  // Sin cuentas propias y sin ser coordinación: no arma calendarios.
  if (!esStaff && !userInRoles(user, ["community_manager"]) && cuentas.length === 0) return null;

  const hoy = hoyYmd();
  const lista = efemeridesEntre(hoy, sumarDias(hoy, 30))
    .map((e) => ({ e, aplican: cuentasQueAplican(e, cuentas) }))
    .filter(({ e, aplican }) => e.alcance === "todas" || aplican.length > 0);
  if (lista.length === 0) return null;

  return (
    <section className="rounded-xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5">
        <CalendarHeart className="h-4 w-4 text-pink-600" />
        <h2 className="text-sm font-semibold">Fechas que se vienen</h2>
        <span className="text-xs text-muted-foreground">· próximos 30 días</span>
        <Link href="/contenidos/efemerides" className="ml-auto text-xs text-primary hover:underline">
          Ver el año
        </Link>
      </div>
      <ul className="divide-y">
        {lista.map(({ e, aplican }) => (
          <FilaEfemeride key={e.fecha + e.nombre} e={e} aplican={aplican} hoy={hoy} />
        ))}
      </ul>
      <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
        Mirá en cada cuenta si amerita: un saludo, una promo o nada. Lo que se use, cargalo en el
        calendario con tiempo.
      </p>
    </section>
  );
}

export function FilaEfemeride({
  e,
  aplican,
  hoy,
}: {
  e: Efemeride;
  aplican: { nombre: string }[];
  hoy: string;
}) {
  const dias = diasHasta(hoy, e.fecha);
  return (
    <li className="flex gap-3 px-4 py-2 text-sm">
      <div className="w-20 shrink-0">
        <div className="font-medium tabular-nums">{fechaLarga(e.fecha)}</div>
        <div className={cn("text-[11px]", dias <= 7 ? "font-medium text-amber-700" : "text-muted-foreground")}>
          {e.aprox ? "aprox. · " : ""}
          {dias >= 0 ? enCuanto(dias) : ""}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">{e.nombre}</span>
          <span
            className={cn(
              "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
              e.alcance === "todas"
                ? "bg-pink-100 text-pink-800 dark:bg-pink-950 dark:text-pink-200"
                : "bg-muted text-muted-foreground"
            )}
          >
            {e.alcance === "todas" ? "Todas las cuentas" : "Según el rubro"}
          </span>
        </div>
        {e.nota && <div className="text-[11px] text-muted-foreground">{e.nota}</div>}
        {aplican.length > 0 && (
          <div className="text-[11px] text-muted-foreground">
            {e.alcance === "todas" ? "Especialmente para: " : "Le puede servir a: "}
            <span className="text-foreground">{aplican.map((c) => c.nombre).join(", ")}</span>
          </div>
        )}
      </div>
    </li>
  );
}
