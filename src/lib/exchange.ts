/**
 * Cotizaciones ARS para USD y EUR.
 * Fuente: dolarapi.com (gratuita, sin API key).
 * Fallback: valores fijos si la API falla.
 * Cache: 12 horas (revalidate en fetch de Next).
 */

const FALLBACK = { USD: 1350, EUR: 1450, USDC: 1560 };

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
