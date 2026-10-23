import Link from "next/link";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { fmtARS } from "@/lib/finanzas";
import { cargarJornadas } from "@/lib/jornadas/cargar";
import { estadoJornada, resumenJornadas } from "@/lib/jornadas/registro";

/**
 * Las jornadas en Mi día (23/10/2026). A la project manager: las que ya se
 * hicieron y falta completar. A dirección: cuánto falta cobrar y pagar.
 * Si no hay nada pendiente, no se muestra.
 */
export async function JornadasPendientes({ esDueno }: { esDueno: boolean }) {
  const hoy = hoyYmd();
  const js = await cargarJornadas(createAdmin()).catch(() => []);
  const res = resumenJornadas(js, hoy);
  const completar = js.filter((j) => estadoJornada(j, hoy) === "completar");
  const proximas = js.filter((j) => estadoJornada(j, hoy) === "agendada").length;
  if (esDueno ? !res.faltaCobrar && !res.faltaPagar && !completar.length : !completar.length) return null;

  return (
    <Link
      href={esDueno ? "/jornadas" : "/jornadas?ver=completar"}
      className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-2xl border bg-card p-4 transition hover:border-primary md:p-5 animate-in fade-in slide-in-from-bottom-2 duration-500"
    >
      <span className="text-3xl" aria-hidden="true">🎬</span>
      <div className="min-w-0 flex-1">
        <h2 className="font-semibold">Jornadas de producción</h2>
        <p className="text-xs text-muted-foreground">
          {esDueno
            ? `${proximas} agendada${proximas === 1 ? "" : "s"} · lo que falta resolver`
            : `Ya se hicieron: confirmá la duración y los viáticos de cada uno para que dirección cobre y pague.`}
        </p>
      </div>
      {completar.length > 0 && <Dato emoji="✍️" valor={String(completar.length)} titulo="para completar" />}
      {esDueno && res.faltaCobrar > 0 && <Dato emoji="💰" valor={fmtARS(res.faltaCobrar)} titulo="falta cobrar" />}
      {esDueno && res.faltaPagar > 0 && <Dato emoji="🤝" valor={fmtARS(res.faltaPagar)} titulo="falta pagar" />}
    </Link>
  );
}

function Dato({ emoji, valor, titulo }: { emoji: string; valor: string; titulo: string }) {
  return (
    <div className="text-right">
      <div className="text-lg font-bold tabular-nums">
        <span aria-hidden="true">{emoji}</span> {valor}
      </div>
      <div className="text-[11px] text-muted-foreground">{titulo}</div>
    </div>
  );
}
