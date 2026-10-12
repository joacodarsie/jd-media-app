import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireUser, userInRoles } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { sumarDias } from "@/lib/retencion/onboarding-15";
import { cuentasQueAplican, efemeridesEntre } from "@/lib/efemerides/argentina";
import { FilaEfemeride } from "@/components/efemerides-proximas";

export const dynamic = "force-dynamic";

const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

/**
 * Las efemérides de los próximos 12 meses, todas (también las de rubro que
 * hoy no le sirven a ninguna cuenta: puede entrar un cliente nuevo de ese rubro).
 */
export default async function EfemeridesPage() {
  const me = await requireUser();
  const hoy = hoyYmd();
  const esStaff = userInRoles(me, ["admin", "coordinador", "coordinador_diseno"]);
  let q = createAdmin().from("clients").select("id, nombre, rubro").eq("estado", "activo").eq("es_interno", false);
  if (!esStaff) q = q.eq("cm_id", me.id);
  const { data } = await q;
  const cuentas = (data ?? []) as { id: string; nombre: string; rubro: string | null }[];

  const lista = efemeridesEntre(hoy, sumarDias(hoy, 365));
  const porMes = new Map<string, typeof lista>();
  for (const e of lista) {
    const k = e.fecha.slice(0, 7);
    porMes.set(k, [...(porMes.get(k) ?? []), e]);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <Link
          href="/contenidos"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Contenidos
        </Link>
        <h1 className="mt-1 text-2xl font-bold">Efemérides</h1>
        <p className="text-muted-foreground">
          Las fechas de Argentina para tener en cuenta al armar los calendarios. Las de{" "}
          <b>todas las cuentas</b> van en todas; las <b>de rubro</b> dicen a qué cuentas les pueden
          servir. Se avisan 30 días antes en Mi día y aparecen marcadas en el calendario.
        </p>
      </div>
      {Array.from(porMes).map(([mes, es]) => (
        <section key={mes} className="rounded-xl border bg-card">
          <h2 className="border-b px-4 py-2 text-sm font-semibold">
            {MESES[Number(mes.slice(5, 7)) - 1]} {mes.slice(0, 4)}
          </h2>
          <ul className="divide-y">
            {es.map((e) => (
              <FilaEfemeride key={e.fecha + e.nombre} e={e} aplican={cuentasQueAplican(e, cuentas)} hoy={hoy} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
