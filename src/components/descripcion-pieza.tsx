import { leerDescripcion } from "@/lib/contenidos/estructura-pieza";

/**
 * Muestra el brief de una pieza. Si está cargado por slides se ve ordenado
 * (título, slides numeradas con su fondo, cierre y CTA); si es un texto libre
 * viejo, tal cual. `portal` usa colores fijos claros, como el resto del portal.
 */
export function DescripcionPieza({
  texto,
  portal = false,
  libre,
}: {
  texto: string;
  portal?: boolean;
  /** Cómo mostrar el texto libre (por defecto, con saltos de línea). */
  libre?: React.ReactNode;
}) {
  const e = leerDescripcion(texto);
  if (!e) {
    return libre ? <>{libre}</> : <p className="whitespace-pre-wrap">{texto}</p>;
  }
  const tenue = portal ? { color: "#777" } : undefined;
  const slides = e.slides.filter((s) => s.texto || s.fondo);
  const etiqueta = "text-[11px] font-semibold uppercase tracking-wide";

  return (
    <div className="space-y-3 text-sm leading-relaxed" style={portal ? { color: "#333" } : undefined}>
      {e.titulo && (
        <p>
          <span className={etiqueta} style={tenue}>
            Título{" "}
          </span>
          <b>{e.titulo}</b>
        </p>
      )}
      {slides.length > 0 && (
        <div>
          <p className={etiqueta} style={tenue}>
            {slides.length === 1 ? "Placa" : `Slides (${slides.length})`}
          </p>
          <ol className="mt-1 space-y-1.5">
            {slides.map((s, i) => (
              <li key={i} className="flex gap-2">
                <span className="w-5 shrink-0 text-right font-semibold" style={tenue}>
                  {i + 1}.
                </span>
                <span>
                  {s.texto}
                  {s.fondo && (
                    <span className={portal ? "" : "text-muted-foreground"} style={tenue}>
                      {s.texto ? " · " : ""}Fondo: {s.fondo}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {(e.cierre || e.cta) && (
        <div className="space-y-0.5">
          {e.cierre && (
            <p>
              <span className={etiqueta} style={tenue}>
                Cierre{" "}
              </span>
              {e.cierre}
            </p>
          )}
          {e.cta && (
            <p>
              <span className={etiqueta} style={tenue}>
                CTA{" "}
              </span>
              <b>{e.cta}</b>
            </p>
          )}
        </div>
      )}
      {e.notas && (
        <p className={portal ? "whitespace-pre-wrap" : "whitespace-pre-wrap text-muted-foreground"} style={tenue}>
          {e.notas}
        </p>
      )}
    </div>
  );
}
