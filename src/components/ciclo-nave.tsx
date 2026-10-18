/**
 * «Dónde estamos» con un cliente (17/10/2026, idea de Santi): una navecita que
 * avanza por el camino de la quincena que se está preparando, del calendario a
 * la publicación. Sale del ciclo quincenal acordado con Luz (lib/ciclo).
 *
 * `portal`: el mismo dibujo, pero hablándole al cliente y destacando lo que le
 * toca a él (con el aviso de que, si no responde, se da por aprobado).
 * Sin JS en el cliente: es CSS puro, sirve en la ficha y en el portal.
 */
import { dondeEstamos, diasEntre, type Hito } from "@/lib/ciclo/ciclo";
import { cn } from "@/lib/utils";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
const corta = (f: string) => `${+f.slice(8, 10)} ${MESES[+f.slice(5, 7) - 1]}`;

const ETIQUETA: Record<Hito["clave"], string> = {
  calendario: "Calendario",
  aprueba_director_calendario: "Revisión",
  aprueba_cliente_calendario: "Aprobás",
  material: "Material",
  produccion: "Producción",
  aprueba_director_piezas: "Revisión",
  aprueba_cliente_piezas: "Aprobás",
  publica: "¡Sale!",
};

const PARA_EL_CLIENTE: Record<Hito["clave"], string> = {
  calendario: "Estamos armando tu calendario",
  aprueba_director_calendario: "Nuestro director creativo está revisando tu calendario",
  aprueba_cliente_calendario: "Tu calendario está listo para que lo apruebes",
  material: "Esperamos tu material",
  produccion: "Estamos diseñando y editando tu contenido",
  aprueba_director_piezas: "Nuestro director creativo está revisando las piezas",
  aprueba_cliente_piezas: "Tus piezas están listas para que las apruebes",
  publica: "Empezamos a publicar",
};

export function CicloNave({ inicio, hoy, portal = false }: { inicio: string; hoy: string; portal?: boolean }) {
  const d = dondeEstamos(inicio, hoy);
  const { preparando: q, hito } = d;
  // El material corre en paralelo con la producción: en el camino va como una parada más.
  const paradas = q.hitos;
  const desde = paradas[0].desde;
  const largo = Math.max(1, diasEntre(desde, q.inicio));
  const x = (f: string) => Math.min(100, Math.max(0, (diasEntre(desde, f) / largo) * 100));
  const avance = d.avance * 100;
  const vence = hito.hasta === hoy ? "hoy" : d.faltan === 1 ? "mañana" : `en ${d.faltan} días (${corta(hito.hasta)})`;

  return (
    <div className="ciclo-nave rounded-2xl border bg-card p-4 sm:p-5">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes ciclo-flota { 0%,100% { transform: translate(-50%, -50%) rotate(-8deg); } 50% { transform: translate(-50%, -62%) rotate(-4deg); } }
        @keyframes ciclo-llama { 0%,100% { opacity: .9; transform: scaleX(1); } 50% { opacity: .55; transform: scaleX(.7); } }
        @keyframes ciclo-estela { from { background-position: 0 0; } to { background-position: 24px 0; } }
        .ciclo-nave .nave { animation: ciclo-flota 2.6s ease-in-out infinite; }
        .ciclo-nave .llama { animation: ciclo-llama .35s ease-in-out infinite; transform-origin: right center; }
        .ciclo-nave .estela { background-image: repeating-linear-gradient(90deg, #ffd400 0 10px, #ffe766 10px 14px); background-size: 24px 100%; animation: ciclo-estela .8s linear infinite; }
        @media (prefers-reduced-motion: reduce) { .ciclo-nave .nave, .ciclo-nave .llama, .ciclo-nave .estela { animation: none; } }
      ` }} />

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <div className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
            {portal ? "Dónde estamos con tu cuenta" : "Dónde estamos"}
          </div>
          <div className="mt-0.5 text-base font-bold">
            {q.arranque ? "Arranque · " : ""}Preparando lo que sale del {corta(q.inicio)} al {corta(q.fin)}
          </div>
        </div>
        {d.publicando && (
          <span className="rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
            ● Publicando del {corta(d.publicando.inicio)} al {corta(d.publicando.fin)}
          </span>
        )}
      </div>

      {/* El camino */}
      <div className="relative mx-3 mb-9 mt-9 h-2 rounded-full bg-muted">
        <div className="estela absolute inset-y-0 left-0 rounded-full" style={{ width: `${avance}%` }} />
        {paradas.map((h) => {
          const hecho = h.hasta < hoy;
          const actual = h === hito;
          const delCliente = h.responsable === "cliente";
          return (
            <div key={h.clave} className="absolute top-1/2" style={{ left: `${x(h.hasta)}%` }}>
              <span
                className={cn(
                  "absolute left-0 top-0 block h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2",
                  hecho ? "border-amber-400 bg-amber-400" : "border-muted-foreground/30 bg-card",
                  actual && "border-foreground ring-4 ring-amber-300/50",
                  delCliente && !hecho && "border-sky-500"
                )}
              />
              <span
                className={cn(
                  "absolute left-0 top-3 hidden -translate-x-1/2 whitespace-nowrap text-center text-[10px] leading-tight sm:block",
                  actual ? "font-bold text-foreground" : "text-muted-foreground"
                )}
              >
                {ETIQUETA[h.clave]}
                <br />
                {corta(h.hasta)}
              </span>
            </div>
          );
        })}
        {/* La navecita */}
        <div className="nave absolute top-1/2 z-10 flex items-center" style={{ left: `${avance}%` }} aria-hidden="true">
          <span className="llama mr-[-2px] block h-2 w-3 rounded-l-full bg-gradient-to-l from-orange-400 to-transparent" />
          <span className="text-2xl leading-none">🚀</span>
        </div>
      </div>

      {/* Qué pasa ahora */}
      {!portal &&
        d.tambien.map((t) => (
          <p key={t.quincena.inicio} className="mb-2 rounded-lg border border-dashed px-3 py-2 text-xs">
            <b>En paralelo:</b> {t.hito.titulo.toLowerCase()} de lo que sale del {corta(t.quincena.inicio)} al {corta(t.quincena.fin)} · vence {t.hito.hasta === hoy ? "hoy" : corta(t.hito.hasta)}
          </p>
        ))}

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-xl bg-muted/50 p-3 text-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Ahora</div>
          <div className="mt-0.5 font-semibold">{portal ? PARA_EL_CLIENTE[hito.clave] : hito.titulo}</div>
          <div className="text-xs text-muted-foreground">Vence {vence}</div>
        </div>
        {d.alCliente ? (
          <div className="rounded-xl border border-sky-400/60 bg-sky-500/10 p-3 text-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
              {portal ? "Te toca a vos" : "Le toca al cliente"}
            </div>
            <div className="mt-0.5 font-semibold">
              {d.alCliente.clave === "material"
                ? `${portal ? "Mandarnos" : "Mandar"} el material hasta el ${corta(d.alCliente.hasta)}`
                : `${portal ? "Aprobar o pedirnos cambios" : "Aprobar o pedir cambios"} hasta el ${corta(d.alCliente.hasta)}`}
            </div>
            {d.alCliente.clave !== "material" && (
              <div className="text-xs text-muted-foreground">Si no hay respuesta en fecha, se da por aprobado.</div>
            )}
          </div>
        ) : (
          <div className="rounded-xl bg-muted/50 p-3 text-sm">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sale</div>
            <div className="mt-0.5 font-semibold">El {corta(q.inicio)}</div>
            <div className="text-xs text-muted-foreground">
              {diasEntre(hoy, q.inicio)} {diasEntre(hoy, q.inicio) === 1 ? "día" : "días"} para publicar
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
