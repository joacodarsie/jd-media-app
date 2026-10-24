import Link from "next/link";
import { BloquePlegable } from "@/components/bloque-plegable";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { cargarCongeladas } from "@/lib/contenidos/congeladas-run";
import { DIAS_QUIETA } from "@/lib/contenidos/congeladas";
import { AvisarCongeladasBoton } from "@/components/avisar-congeladas-boton";

/**
 * Piezas congeladas en Mi día de coordinación y dirección (22/10/2026): quién
 * tiene piezas que no se mueven hace 5+ días, con la más vieja a la vista y un
 * «Avisar» por persona. Ver lib/contenidos/congeladas.ts.
 */
export async function PiezasCongeladas({ meId }: { meId: string }) {
  const grupos = await cargarCongeladas(createAdmin(), hoyYmd()).catch(() => []);
  if (!grupos.length) return null;
  const total = grupos.reduce((n, g) => n + g.piezas.length, 0);

  return (
    <BloquePlegable
      id="congeladas"
      emoji="🧊"
      className="border-sky-500/30"
      titulo={`${total} pieza${total === 1 ? "" : "s"} congelada${total === 1 ? "" : "s"}`}
      resumen={`Sin moverse hace ${DIAS_QUIETA} días o más · ${grupos.length} persona${grupos.length === 1 ? "" : "s"}`}
    >
      <ul className="-mt-1 divide-y">
        {grupos.map((g) => (
          <li key={g.responsableId ?? "sin"} className="py-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm">
                <b>{g.responsable}</b>{" "}
                <span className="text-muted-foreground">
                  · {g.piezas.length} pieza{g.piezas.length === 1 ? "" : "s"} · la más vieja, {g.maxDias} días quieta
                </span>
              </p>
              {g.responsableId && g.responsableId !== meId && <AvisarCongeladasBoton responsableId={g.responsableId} />}
            </div>
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {g.piezas.slice(0, 6).map((p) => (
                <li key={p.taskId}>
                  <Link
                    href={`/tareas/${p.taskId}`}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] hover:bg-muted ${p.atrasada ? "border-red-500/40 text-red-700 dark:text-red-300" : ""}`}
                    title={`${p.titulo} · ${p.diasQuieta} días sin moverse`}
                  >
                    <span className="whitespace-nowrap font-medium">{p.cuenta}</span>
                    <span className="max-w-[8rem] truncate sm:max-w-[12rem] text-muted-foreground">{p.titulo}</span>
                    <span className="tabular-nums">{p.diasQuieta}d</span>
                  </Link>
                </li>
              ))}
              {g.piezas.length > 6 && <li className="self-center text-[11px] text-muted-foreground">y {g.piezas.length - 6} más</li>}
            </ul>
          </li>
        ))}
      </ul>
    </BloquePlegable>
  );
}
