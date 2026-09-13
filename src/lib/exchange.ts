/**
 * Cotizaciones ARS para USD y EUR.
 * Fuente: dolarapi.com (gratuita, sin API key).
 * Fallback: valores fijos si la API falla.
 * Cache: 12 horas (revalidate en fetch de Next).
 */

// Actualizados 2026-07: si la API cae, mejor errar por poco que usar un dólar viejo.
const FALLBACK = { USD: 1500, EUR: 1750, USDC: 1560 };

interface DolarApiItem {
  casa: string;
  nombre: string;
  compra: number;
  venta: number;
  fechaActualizacion: string;
}

export interface ExchangeRates {
  USD: number;
  EUR: number;
  /**
   * Dólar cripto / USDC (mismo que muestra dolarhoy.com como "Cripto"). Es el que
   * usa la agencia para pagar sus suscripciones en dólares, así que los costos
   * fijos en USD se convierten con este, no con el blue.
   */
  USDC: number;
  source: "live" | "fallback";
  fetchedAt: string;
}

/**
 * La cotización de UNA FECHA PASADA.
 *
 * Hace falta porque los gastos en dólares de un mes cerrado se tienen que
 * valuar al dólar de ESE mes. Mientras se convertían al dólar de hoy, julio
 * cambiaba de valor todos los días y la serie histórica no paraba de moverse
 * — que es una de las razones por las que el dueño no le creía a los números.
 *
 * Fuente: api.argentinadatos.com (mismo origen que dolarapi, con histórico).
 * Si el día pedido no tiene cotización (fin de semana, feriado) retrocede hasta
 * cinco días. Si no consigue nada, devuelve null y el que llama decide.
 */
export async function getExchangeRatesForDate(
  fecha: string
): Promise<{ USD: number; USDC: number; fecha: string } | null> {
  for (let i = 0; i < 6; i++) {
    const d = new Date(fecha + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - i);
    const ymd = d.toISOString().slice(0, 10);
    const [y, m, day] = ymd.split("-");
    try {
      const [blueRes, criptoRes] = await Promise.all([
        fetch(`https://api.argentinadatos.com/v1/cotizaciones/dolares/blue/${y}/${m}/${day}`),
        fetch(`https://api.argentinadatos.com/v1/cotizaciones/dolares/cripto/${y}/${m}/${day}`),
      ]);
      if (!blueRes.ok && !criptoRes.ok) continue;
      const blue = blueRes.ok ? ((await blueRes.json()) as DolarApiItem) : null;
      const cripto = criptoRes.ok ? ((await criptoRes.json()) as DolarApiItem) : null;
      const mid = (x: DolarApiItem | null) =>
        x && Number.isFinite(x.compra) && Number.isFinite(x.venta)
          ? Math.round((x.compra + x.venta) / 2)
          : null;
      const usd = mid(blue);
      const usdc = mid(cripto);
      if (usd == null && usdc == null) continue;
      return { USD: usd ?? usdc!, USDC: usdc ?? usd!, fecha: ymd };
    } catch {
      // Red caída o respuesta rara: probamos el día anterior.
    }
  }
  return null;
}

export async function getExchangeRates(): Promise<ExchangeRates> {
  try {
    const [usdRes, eurRes, criptoRes] = await Promise.all([
      fetch("https://dolarapi.com/v1/dolares/blue", {
        next: { revalidate: 12 * 60 * 60 },
      }),
      fetch("https://dolarapi.com/v1/cotizaciones/eur", {
        next: { revalidate: 12 * 60 * 60 },
      }),
      fetch("https://dolarapi.com/v1/dolares/cripto", {
        next: { revalidate: 12 * 60 * 60 },
      }),
    ]);
    if (!usdRes.ok || !eurRes.ok) throw new Error("api status not ok");
    const usd = (await usdRes.json()) as DolarApiItem;
    const eur = (await eurRes.json()) as DolarApiItem;
    // El cripto es opcional: si falla, caemos al blue para no romper.
    const cripto = criptoRes.ok ? ((await criptoRes.json()) as DolarApiItem) : null;
    const usdMid = Math.round((usd.compra + usd.venta) / 2);
    return {
      USD: usdMid,
      EUR: Math.round((eur.compra + eur.venta) / 2),
      USDC: cripto ? Math.round((cripto.compra + cripto.venta) / 2) : usdMid,
      source: "live",
      fetchedAt: usd.fechaActualizacion ?? new Date().toISOString(),
    };
  } catch {
    return {
      USD: FALLBACK.USD,
      EUR: FALLBACK.EUR,
      USDC: FALLBACK.USDC,
      source: "fallback",
      fetchedAt: new Date().toISOString(),
    };
  }
}
