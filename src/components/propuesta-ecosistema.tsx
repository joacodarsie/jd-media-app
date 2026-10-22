/**
 * El ecosistema digital de la propuesta (21/10/2026): la marca al centro, las
 * cuatro redes alrededor, la publicidad en Meta que las conecta y, punteado,
 * hacia dónde se va después. Es el dibujo de las propuestas hechas a mano que
 * el dueño extrañó en el generador («estéticamente queda más pro»). SVG puro,
 * sin JS: se imprime igual que en pantalla.
 */
import { lineasDeMarca } from "@/lib/propuestas/iconos";

export function PropuestaEcosistema({ empresa, zona }: { empresa: string; zona: string | null }) {
  const { lineas, tam } = lineasDeMarca(empresa);
  const y0 = 235 + tam * 0.35 - ((lineas.length - 1) * tam * 1.05) / 2;
  return (
    <>
      <div className="eco">
        <svg viewBox="0 0 680 470" xmlns="http://www.w3.org/2000/svg" fontFamily="Inter, sans-serif" role="img" aria-label={`El ecosistema digital de ${empresa}`}>
          <defs>
            <filter id="glow" x="-80%" y="-80%" width="260%" height="260%">
              <feGaussianBlur stdDeviation="9" result="b" />
              <feMerge>
                <feMergeNode in="b" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <marker id="flecha" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0L10 5L0 10z" fill="rgba(255,255,255,.55)" />
            </marker>
          </defs>

          <g stroke="rgba(255,212,0,.55)" strokeWidth="2">
            <line x1="340" y1="235" x2="175" y2="130" />
            <line x1="340" y1="235" x2="505" y2="130" />
            <line x1="340" y1="235" x2="175" y2="340" />
            <line x1="340" y1="235" x2="505" y2="340" />
            <line x1="340" y1="235" x2="340" y2="405" />
          </g>
          <g stroke="rgba(255,255,255,.45)" strokeWidth="1.6" strokeDasharray="5 5" fill="none" markerEnd="url(#flecha)">
            <path d="M200 112 Q 260 52 300 52" />
            <path d="M480 112 Q 420 52 380 52" />
            <path d="M150 360 Q 80 330 72 285" />
            <path d="M530 360 Q 600 330 608 285" />
            <path d="M150 118 Q 70 160 70 192" />
            <path d="M530 118 Q 610 160 610 192" />
          </g>

          <g fill="none" stroke="rgba(255,255,255,.6)" strokeWidth="1.6" strokeDasharray="5 4">
            <rect x="275" y="22" width="130" height="52" rx="14" />
            <rect x="14" y="200" width="112" height="78" rx="14" />
            <rect x="554" y="200" width="112" height="78" rx="14" />
          </g>
          <g fill="#fff" textAnchor="middle">
            <text x="340" y="45" fontSize="12" fontWeight="800">Web</text>
            <text x="340" y="62" fontSize="9.5" fill="rgba(255,255,255,.6)">visitas que consultan</text>
            <text x="70" y="232" fontSize="12" fontWeight="800">Comunidad</text>
            <text x="70" y="248" fontSize="9.5" fill="rgba(255,255,255,.6)">clientes que</text>
            <text x="70" y="262" fontSize="9.5" fill="rgba(255,255,255,.6)">vuelven</text>
            <text x="610" y="232" fontSize="12" fontWeight="800">Google</text>
            <text x="610" y="248" fontSize="9.5" fill="rgba(255,255,255,.6)">los que ya</text>
            <text x="610" y="262" fontSize="9.5" fill="rgba(255,255,255,.6)">te buscan</text>
          </g>

          <g filter="url(#glow)" fill="#FFD400">
            <circle cx="175" cy="130" r="34" />
            <circle cx="505" cy="130" r="34" />
            <circle cx="175" cy="340" r="34" />
            <circle cx="505" cy="340" r="34" />
          </g>
          {/* Instagram */}
          <g fill="none" stroke="#0A0A0B" strokeWidth="3">
            <rect x="160" y="115" width="30" height="30" rx="9" />
            <circle cx="175" cy="130" r="7" />
          </g>
          <circle cx="184" cy="121" r="2" fill="#0A0A0B" />
          {/* TikTok */}
          <path
            d="M507 112h7c.6 5 3.6 8.4 8.6 8.9v7c-3.3 0-6.2-1-8.6-2.7v13.6c0 7-5.5 11.7-11.7 11.7-6.6 0-11.4-5-11.4-11.3 0-6.7 5.7-11.6 12.4-10.9v7.2c-2.6-.6-5.4 1.2-5.4 3.8 0 2.4 1.9 4.2 4.3 4.2 2.6 0 4.4-2 4.4-4.6z"
            fill="#0A0A0B"
          />
          {/* Facebook */}
          <path d="M179 357v-14h4.8l.7-5.6H179v-3.6c0-1.6.5-2.7 2.8-2.7h3v-5c-.5-.1-2.3-.2-4.4-.2-4.3 0-7.3 2.6-7.3 7.5v4H168v5.6h5.1V357z" fill="#0A0A0B" />
          {/* WhatsApp */}
          <path d="M505 322c-10 0-18 8-18 17.8 0 3.2.9 6.3 2.5 9l-2.7 9.6 9.9-2.6c2.6 1.4 5.4 2.1 8.3 2.1 10 0 18-8 18-17.9S515 322 505 322z" fill="none" stroke="#0A0A0B" strokeWidth="3" />
          <path
            d="M498.5 332.5c.6-.6 1.6-.7 2.1 0l1.8 3c.3.6.2 1.3-.3 1.7l-1.1 1c.9 2.1 2.7 3.9 4.9 4.9l1-1.1c.4-.5 1.1-.6 1.7-.3l3 1.8c.7.5.7 1.5 0 2.1l-1.3 1.3c-1 1-2.6 1.3-4 .7-4.4-1.8-8-5.4-9.8-9.8-.6-1.4-.3-3 .7-4z"
            fill="#0A0A0B"
          />
          <g fill="#fff" fontSize="12" fontWeight="800" textAnchor="middle">
            <text x="175" y="186">Instagram</text>
            <text x="505" y="186">TikTok</text>
            <text x="175" y="396">Facebook</text>
            <text x="505" y="396">WhatsApp</text>
          </g>
          <g fill="rgba(255,255,255,.6)" fontSize="9.5" textAnchor="middle">
            <text x="175" y="200">la vidriera</text>
            <text x="505" y="200">alcance nuevo</text>
            <text x="175" y="410">la comunidad local</text>
            <text x="505" y="410">donde llegan las consultas</text>
          </g>

          <rect x="262" y="410" width="156" height="40" rx="20" fill="#fff" />
          <text x="340" y="428" fill="#0A0A0B" fontSize="11.5" fontWeight="800" textAnchor="middle">
            Publicidad en Meta
          </text>
          <text x="340" y="442" fill="rgba(10,10,11,.6)" fontSize="9" textAnchor="middle">
            {(zona?.trim() || "tu zona").slice(0, 28)}
          </text>

          <circle cx="340" cy="235" r="66" fill="#fff" />
          <circle cx="340" cy="235" r="74" fill="none" stroke="rgba(255,212,0,.35)" strokeWidth="1.5" />
          <g textAnchor="middle" fill="#0A0A0B" fontWeight="900" fontSize={tam} letterSpacing="-.4">
            {lineas.map((l, i) => (
              <text key={i} x="340" y={y0 + i * tam * 1.05}>
                {l}
              </text>
            ))}
          </g>
        </svg>
      </div>
      <div className="leyenda">
        <span>
          <i className="on" />
          Dónde arrancamos (incluido)
        </span>
        <span>
          <i className="base" />
          La publicidad que conecta todo
        </span>
        <span>
          <i className="next" />
          Hacia dónde vamos
        </span>
      </div>
    </>
  );
}
