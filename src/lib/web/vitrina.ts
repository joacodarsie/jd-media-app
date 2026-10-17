/**
 * Lo que la web muestra del crecimiento de las cuentas (17/10/2026). PURO.
 *
 * - Antes y después: solo cuentas que se pueden mostrar (`mostrar_en_web`),
 *   con las dos grillas completas y al menos dos mejoras de verdad. En la web
 *   van solo las mejoras: lo que bajó se trabaja adentro, no se publica.
 * - En vivo: cuántas publicaciones salieron en la semana, de cuántas marcas,
 *   y la última.
 */
import type { Comparacion, CeldaGrilla } from "@/lib/crecimiento/foto";

export interface CasoWeb {
  nombre: string;
  usuario: string | null;
  meses: number;
  antes: { fecha: string; grilla: CeldaGrilla[] };
  hoy: { fecha: string; grilla: CeldaGrilla[] };
  logros: { titulo: string; antes: number; hoy: number; cambio: string }[];
}

export interface CandidatoCaso {
  nombre: string;
  usuario: string | null;
  meses: number | null;
  antes: { fecha: string; grilla: CeldaGrilla[] } | null;
  hoy: { fecha: string; grilla: CeldaGrilla[] } | null;
  comparaciones: Comparacion[];
}

/** Puntos para ordenar: cuánto mejoró, con más peso a seguidores y constancia. */
function fuerza(c: Comparacion): number {
  const base = c.antes > 0 ? (c.hoy - c.antes) / c.antes : c.hoy > 0 ? 3 : 0;
  const peso = c.clave === "seguidores" ? 2 : c.clave === "posts_mes" ? 1.5 : 1;
  return Math.min(5, base) * peso;
}

export function elegirCasos(candidatos: CandidatoCaso[], max = 4): CasoWeb[] {
  return candidatos
    .filter((c) => c.antes && c.hoy && c.antes.grilla.length >= 6 && c.hoy.grilla.length >= 6 && (c.meses ?? 0) >= 1)
    .map((c) => {
      const buenas = c.comparaciones.filter((x) => x.mejoro && x.clave !== "puntaje");
      return { c, buenas, puntos: buenas.reduce((s, x) => s + fuerza(x), 0) };
    })
    .filter((x) => x.buenas.length >= 2)
    .sort((a, b) => b.puntos - a.puntos)
    .slice(0, max)
    .map(({ c, buenas }) => ({
      nombre: c.nombre,
      usuario: c.usuario,
      meses: c.meses ?? 1,
      antes: { fecha: c.antes!.fecha, grilla: c.antes!.grilla.slice(0, 9) },
      hoy: { fecha: c.hoy!.fecha, grilla: c.hoy!.grilla.slice(0, 9) },
      logros: buenas
        .sort((a, b) => fuerza(b) - fuerza(a))
        .slice(0, 3)
        .map((x) => ({ titulo: x.titulo, antes: x.antes, hoy: x.hoy, cambio: x.cambio })),
    }));
}

export interface EnVivo {
  publicaciones: number;
  dias: 7 | 30;
  marcas: number;
  ultima: { marca: string; hace: string } | null;
}

export function haceCuanto(iso: string, ahora = Date.now()): string {
  const min = Math.max(1, Math.round((ahora - Date.parse(iso)) / 60_000));
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} ${h === 1 ? "hora" : "horas"}`;
  const d = Math.round(h / 24);
  return `hace ${d} ${d === 1 ? "día" : "días"}`;
}

/** Resume las publicaciones recientes de cada marca. Si la semana es flaca, muestra el mes. */
export function resumirEnVivo(cuentas: { marca: string; fechas: string[] }[], ahora = Date.now()): EnVivo {
  const dentro = (dias: number) =>
    cuentas.map((c) => ({ marca: c.marca, n: c.fechas.filter((f) => ahora - Date.parse(f) <= dias * 86_400_000).length }));
  let dias: 7 | 30 = 7;
  let lista = dentro(7);
  if (lista.reduce((s, x) => s + x.n, 0) < 12) { dias = 30; lista = dentro(30); }
  let ultima: { marca: string; fecha: string } | null = null;
  for (const c of cuentas) for (const f of c.fechas) if (!ultima || f > ultima.fecha) ultima = { marca: c.marca, fecha: f };
  return {
    publicaciones: lista.reduce((s, x) => s + x.n, 0),
    dias,
    marcas: lista.filter((x) => x.n > 0).length,
    ultima: ultima ? { marca: ultima.marca, hace: haceCuanto(ultima.fecha, ahora) } : null,
  };
}
