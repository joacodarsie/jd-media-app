import Link from "next/link";
import { ArrowLeft, AtSign } from "lucide-react";
import { redirect } from "next/navigation";
import { requireUser, isStaffUser, userInRoles, getAccessibleClientIds } from "@/lib/auth";
import { runConciliacionDiaria } from "@/lib/social/conciliar-run";
import { metaConfigured } from "@/lib/meta/instagram";
import { ConciliacionPanel } from "@/components/conciliacion-panel";

export const dynamic = "force-dynamic";

const PUEDE_VER = ["admin", "coordinador", "community_manager"];

/**
 * "¿Salió de verdad?" — el feed real de Instagram contra el calendario.
 *
 * El 6 de agosto de 2026 el calendario mentía para los dos lados: Boxescar y
 * Power Collections habían publicado y la app decía 0; Résonar tenía una pieza
 * en "publicado" que en Instagram no existía. Con eso, la puntualidad, el
 * semáforo del Director y el reporte que ve el cliente están armados sobre
 * datos que nadie mantiene.
 *
 * No gasta cuota de Meta: lee el feed que el sync diario ya dejó guardado en
 * ig_snapshots.
 */
export default async function SalioPage() {
  const me = await requireUser();
  if (!isStaffUser(me) && !userInRoles(me, PUEDE_VER)) redirect("/contenidos");

  const misClientes = await getAccessibleClientIds(me);
  const { cuentas } = await runConciliacionDiaria();
  const visibles = misClientes
    ? cuentas.filter((c) => misClientes.includes(c.clienteId))
    : cuentas;

  const totalAplicables = visibles.reduce((a, c) => a + c.aplicados.length, 0);
  const totalDudosos = visibles.reduce((a, c) => a + c.dudosos.length, 0);
  const totalFantasmas = visibles.reduce((a, c) => a + c.conciliacion.fantasmas.length, 0);
  const totalSinPieza = visibles.reduce((a, c) => a + c.conciliacion.sinPieza.length, 0);
  const salieron = visibles.reduce((a, c) => a + c.resumen.salieron, 0);
  const enFecha = visibles.reduce((a, c) => a + c.resumen.enFecha, 0);
  const tarde = visibles.reduce((a, c) => a + c.resumen.tarde, 0);

  return (
    <div className="space-y-5">
      <Link
        href="/contenidos"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver al calendario
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <AtSign className="h-6 w-6 text-primary" /> ¿Salió de verdad?
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Compara lo que <b>realmente</b> se publicó en Instagram contra lo que dice
          el calendario. Lo que coincide sin dudas se marca solo; lo dudoso lo
          confirmás vos. Así el atraso que muestra la app es el atraso de verdad
          — y el reporte del cliente también.
        </p>
      </div>

      {!metaConfigured() && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          Meta no está configurado en la app: sin eso no hay feed con qué comparar.
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Salió este mes" valor={salieron} tono="neutral" />
        <Stat label="En la fecha" valor={enFecha} tono="ok" />
        <Stat label="Salió tarde" valor={tarde} tono="alerta" />
        <Stat label="Para marcar solas" valor={totalAplicables} tono="ok" />
        <Stat label="Para confirmar" valor={totalDudosos} tono="neutral" />
        <Stat label="Dice publicado y no está" valor={totalFantasmas} tono="mal" />
      </div>

      {totalSinPieza > 0 && (
        <p className="text-sm text-muted-foreground">
          Además hay <b>{totalSinPieza}</b> posteo{totalSinPieza === 1 ? "" : "s"} que
          salió sin estar en el calendario. Se puede registrar con un clic para que
          entre en el reporte del cliente.
        </p>
      )}

      {visibles.length === 0 ? (
        <div className="rounded-xl border bg-muted/30 p-6 text-center text-sm text-muted-foreground">
          No hay cuentas activas con Instagram conectado.{" "}
          <Link href="/clientes/conectar-instagram" className="underline">
            Conectar Instagram
          </Link>
        </div>
      ) : (
        <ConciliacionPanel
          cuentas={visibles.map((c) => ({
            clienteId: c.clienteId,
            clienteNombre: c.clienteNombre,
            fechaSnapshot: c.fechaSnapshot,
            nota: c.nota ?? null,
            resumen: c.resumen,
            aplicables: c.aplicados.map((m) => ({
              piezaId: m.piezaId,
              titulo: m.piezaTitulo,
              permalink: m.permalink,
              fechaReal: m.fechaReal,
              fechaPlan: m.fechaPlan,
              diasDiferencia: m.diasDiferencia,
              motivo: m.motivo,
            })),
            dudosos: c.dudosos.map((m) => ({
              piezaId: m.piezaId,
              titulo: m.piezaTitulo,
              mediaId: m.mediaId,
              permalink: m.permalink,
              fechaReal: m.fechaReal,
              fechaPlan: m.fechaPlan,
              motivo: m.motivo,
              score: m.score,
            })),
            sinPieza: c.conciliacion.sinPieza.map((m) => ({
              id: m.id,
              caption: m.caption,
              media_type: m.media_type,
              permalink: m.permalink,
              timestamp: m.timestamp,
            })),
            fantasmas: c.conciliacion.fantasmas,
          }))}
        />
      )}
    </div>
  );
}

function Stat({
  label,
  valor,
  tono,
}: {
  label: string;
  valor: number;
  tono: "ok" | "alerta" | "mal" | "neutral";
}) {
  const color =
    tono === "ok"
      ? "text-emerald-700 dark:text-emerald-300"
      : tono === "alerta"
        ? "text-amber-700 dark:text-amber-300"
        : tono === "mal" && valor > 0
          ? "text-red-700 dark:text-red-300"
          : "text-foreground";
  return (
    <div className="rounded-xl border bg-background p-3">
      <p className={`text-2xl font-bold tabular-nums ${color}`}>{valor}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
