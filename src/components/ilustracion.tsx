import { cn } from "@/lib/utils";

/**
 * Dibujitos para las pantallas vacías (22/10/2026). Pedido del dueño: la
 * plataforma «es todo tan serio»; sumar ilustraciones que representen lo que
 * pasa. SVG en línea: no pesan, se ven nítidos y toman los colores del tema
 * (currentColor + el amarillo de la marca), así andan en claro y en oscuro.
 * Animación suave de entrada y de flote, que se apaga con «reducir movimiento».
 */
export type Escena = "listo" | "calendario" | "buscar" | "contenido" | "charla" | "cohete" | "grafico" | "equipo";

const AMARILLO = "#FFD400";

function Trazo({ escena }: { escena: Escena }) {
  switch (escena) {
    case "listo":
      // Una lista tildada con chispas: «todo al día».
      return (
        <>
          <rect x="34" y="18" width="52" height="66" rx="8" className="fill-card stroke-current" strokeWidth="2.5" />
          <rect x="48" y="12" width="24" height="10" rx="4" fill={AMARILLO} />
          {[36, 52, 68].map((y, i) => (
            <g key={y} className="jd-ilu-linea" style={{ animationDelay: `${200 + i * 160}ms` }}>
              <path d={`M43 ${y}l4 4 7-8`} stroke={AMARILLO} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <line x1="60" y1={y} x2="78" y2={y} className="stroke-current" strokeOpacity=".35" strokeWidth="3" strokeLinecap="round" />
            </g>
          ))}
          <path className="jd-ilu-chispa" d="M96 22l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill={AMARILLO} />
          <path className="jd-ilu-chispa" style={{ animationDelay: "600ms" }} d="M22 60l1.5 4 4 1.5-4 1.5-1.5 4-1.5-4-4-1.5 4-1.5z" fill={AMARILLO} />
        </>
      );
    case "calendario":
      // Un calendario con una taza: «día libre».
      return (
        <>
          <rect x="22" y="24" width="60" height="56" rx="8" className="fill-card stroke-current" strokeWidth="2.5" />
          <rect x="22" y="24" width="60" height="14" rx="6" fill={AMARILLO} />
          {[0, 1, 2].map((r) =>
            [0, 1, 2, 3].map((c) => (
              <rect key={`${r}${c}`} x={30 + c * 12} y={46 + r * 10} width="7" height="5" rx="1.5" className="fill-current" fillOpacity={r === 1 && c === 2 ? 0.9 : 0.18} />
            ))
          )}
          <g className="jd-ilu-flota">
            <path d="M84 58h18v14a9 9 0 0 1-9 9h0a9 9 0 0 1-9-9z" className="fill-card stroke-current" strokeWidth="2.5" />
            <path d="M102 62h3a4 4 0 0 1 0 8h-3" className="stroke-current" strokeWidth="2.5" fill="none" />
            <path className="jd-ilu-vapor" d="M90 52c-2-3 2-4 0-7M96 52c-2-3 2-4 0-7" stroke={AMARILLO} strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </g>
        </>
      );
    case "buscar":
      // Una lupa sobre hojas: «no hay resultados».
      return (
        <>
          <rect x="24" y="30" width="46" height="54" rx="6" className="fill-card stroke-current" strokeOpacity=".4" strokeWidth="2.5" />
          <rect x="36" y="20" width="46" height="54" rx="6" className="fill-card stroke-current" strokeWidth="2.5" />
          {[34, 44, 54].map((y) => (
            <line key={y} x1="44" y1={y} x2="72" y2={y} className="stroke-current" strokeOpacity=".3" strokeWidth="3" strokeLinecap="round" />
          ))}
          <g className="jd-ilu-flota">
            <circle cx="80" cy="66" r="13" className="fill-card" stroke={AMARILLO} strokeWidth="4" />
            <line x1="89" y1="76" x2="100" y2="88" stroke={AMARILLO} strokeWidth="5" strokeLinecap="round" />
          </g>
        </>
      );
    case "contenido":
      // Un celular con publicaciones y un corazón: «calendario de contenido».
      return (
        <>
          <rect x="38" y="12" width="44" height="78" rx="9" className="fill-card stroke-current" strokeWidth="2.5" />
          <rect x="45" y="22" width="30" height="24" rx="4" fill={AMARILLO} fillOpacity=".85" />
          <rect x="45" y="50" width="14" height="14" rx="3" className="fill-current" fillOpacity=".2" />
          <rect x="61" y="50" width="14" height="14" rx="3" className="fill-current" fillOpacity=".2" />
          <rect x="45" y="68" width="14" height="14" rx="3" className="fill-current" fillOpacity=".2" />
          <rect x="61" y="68" width="14" height="14" rx="3" className="fill-current" fillOpacity=".2" />
          <path className="jd-ilu-corazon" d="M96 30c0-4 6-6 8-1 2-5 8-3 8 1 0 5-8 10-8 10s-8-5-8-10z" fill="#f43f5e" />
        </>
      );
    case "charla":
      // Dos globos de diálogo: «sin mensajes».
      return (
        <>
          <path d="M18 28h52a8 8 0 0 1 8 8v20a8 8 0 0 1-8 8H38l-12 10v-10h-8a8 8 0 0 1-8-8V36a8 8 0 0 1 8-8z" className="fill-card stroke-current" strokeWidth="2.5" transform="translate(4 0)" />
          <g className="jd-ilu-flota">
            <path d="M58 52h40a7 7 0 0 1 7 7v16a7 7 0 0 1-7 7h-4v9l-10-9H58a7 7 0 0 1-7-7V59a7 7 0 0 1 7-7z" fill={AMARILLO} />
            {[68, 78, 88].map((x, i) => (
              <circle key={x} className="jd-ilu-punto" style={{ animationDelay: `${i * 180}ms` }} cx={x} cy="67" r="3" fill="#111" />
            ))}
          </g>
        </>
      );
    case "cohete":
      // Un cohete despegando: «arranques».
      return (
        <>
          <g className="jd-ilu-flota">
            <path d="M60 14c14 10 18 30 12 50H48c-6-20-2-40 12-50z" className="fill-card stroke-current" strokeWidth="2.5" />
            <circle cx="60" cy="38" r="7" fill={AMARILLO} />
            <path d="M48 52l-10 12h12M72 52l10 12H70" className="fill-current" fillOpacity=".25" />
            <path className="jd-ilu-fuego" d="M52 66c2 10 6 16 8 20 2-4 6-10 8-20z" fill={AMARILLO} />
          </g>
          {[[22, 30], [96, 24], [100, 70], [18, 74]].map(([x, y], i) => (
            <circle key={i} className="jd-ilu-chispa" style={{ animationDelay: `${i * 300}ms` }} cx={x} cy={y} r="2.5" fill={AMARILLO} />
          ))}
        </>
      );
    case "grafico":
      // Barras que crecen con una flecha: «números».
      return (
        <>
          <line x1="20" y1="86" x2="102" y2="86" className="stroke-current" strokeOpacity=".4" strokeWidth="2.5" strokeLinecap="round" />
          {[
            [28, 54],
            [46, 40],
            [64, 28],
            [82, 16],
          ].map(([x, y], i) => (
            <rect key={x} className="jd-ilu-barra" style={{ animationDelay: `${i * 120}ms` }} x={x} y={y + 14} width="12" height={72 - y} rx="3" fill={i === 3 ? AMARILLO : "currentColor"} fillOpacity={i === 3 ? 1 : 0.22} />
          ))}
          <path className="jd-ilu-linea" d="M26 58l20-14 18-10 26-20" stroke={AMARILLO} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <path d="M84 12l8 1-2 8" stroke={AMARILLO} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </>
      );
    case "equipo":
      // Tres caritas: «el equipo».
      return (
        <>
          {[
            [36, 54, 0.22],
            [84, 54, 0.22],
            [60, 46, 1],
          ].map(([x, y, o], i) => (
            <g key={i} className="jd-ilu-flota" style={{ animationDelay: `${i * 400}ms` }}>
              <circle cx={x} cy={y} r="14" fill={o === 1 ? AMARILLO : "currentColor"} fillOpacity={o} />
              <path d={`M${x - 20} ${y + 36}a20 16 0 0 1 40 0`} fill={o === 1 ? AMARILLO : "currentColor"} fillOpacity={o === 1 ? 0.85 : 0.18} />
            </g>
          ))}
        </>
      );
  }
}

export function Ilustracion({ escena, className }: { escena: Escena; className?: string }) {
  return (
    <svg
      viewBox="0 0 120 100"
      className={cn("h-20 w-24 text-foreground/80 jd-ilu", className)}
      aria-hidden="true"
      fill="none"
    >
      <Trazo escena={escena} />
    </svg>
  );
}
