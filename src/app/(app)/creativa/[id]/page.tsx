import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { periodLabel } from "@/lib/finanzas";
import { cargarCuentasCreativas, puedeCreativa } from "@/lib/creativa/cargar";
import { AVISO_DIAS } from "@/lib/creativa/creativa";
import { imagenChica } from "@/lib/web/imagenes";
import { CreativaDocumentos } from "@/components/creativa-documentos";
import { CreativaDefinicion } from "@/components/creativa-definicion";
import { EstadoMes } from "../estado-mes";

export const dynamic = "force-dynamic";

const mesNombre = (m: string) => {
  const n = periodLabel(m).split(" ")[0];
  return n.charAt(0).toUpperCase() + n.slice(1);
};

/** La ficha creativa de una cuenta (boceto «Detalle» de Santi, 23/10/2026). */
export default async function CreativaCuentaPage({ params }: { params: { id: string } }) {
  const me = await requireUser();
  if (!puedeCreativa(me)) redirect("/dashboard");
  const [c] = await cargarCuentasCreativas(createAdmin(), hoyYmd(), params.id);
  if (!c) notFound();
  const hechos = c.pasos.filter((p) => p.hecho).length;

  return (
    <div className="space-y-6">
      <Link href="/creativa" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Volver al listado
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {c.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={imagenChica(c.logo, 120)} alt="" className="h-12 w-12 rounded-xl bg-white object-contain" />
          ) : (
            <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary text-lg font-bold text-primary-foreground">{c.nombre[0]}</span>
          )}
          <div>
            <h1 className="text-2xl font-bold">{c.nombre}</h1>
            {c.rubro && <p className="text-sm text-muted-foreground">{c.rubro}</p>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {c.meses.map((m) => (
            <Link key={m.mes} href={`/contenidos?cliente=${c.id}`}>
              <EstadoMes m={m} prefijo={mesNombre(m.mes)} />
            </Link>
          ))}
        </div>
      </div>

      <section className="space-y-2">
        <div>
          <h2 className="font-semibold">Documentos de campaña</h2>
          <p className="text-xs text-muted-foreground">
            Cada documento queda disponible para que JDmedIA lo use como referencia. La vigencia se define con inicio y duración; {AVISO_DIAS} días
            antes de vencer se marca en rojo para replantear la estrategia.
          </p>
        </div>
        <CreativaDocumentos clienteId={c.id} docs={c.docs} />
      </section>

      <section className="space-y-3 rounded-2xl border bg-card p-4 md:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-semibold">Definición creativa</h2>
            <p className="text-xs text-muted-foreground">Identidad, tono, medios y urgencia. Es parte del onboarding creativo de la cuenta.</p>
          </div>
          <Link
            href={`/clientes/${c.id}/onboarding/creativa`}
            className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
          >
            Onboarding creativo · {hechos}/{c.pasos.length} <ChevronRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <CreativaDefinicion clienteId={c.id} inicial={c.definicion} />
      </section>
    </div>
  );
}
