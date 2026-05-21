/**
 * Cotizaciones ARS para USD y EUR.
 * Fuente: dolarapi.com (gratuita, sin API key).
 * Fallback: valores fijos si la API falla.
 * Cache: 12 horas (revalidate en fetch de Next).
 */

const FALLBACK = { USD: 1350, EUR: 1450 };

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
  source: "live" | "fallback";
  fetchedAt: string;
}

export async function getExchangeRates(): Promise<ExchangeRates> {
  try {
    const [usdRes, eurRes] = await Promise.all([
      fetch("https://dolarapi.com/v1/dolares/blue", {
        next: { revalidate: 12 * 60 * 60 },
      }),
      fetch("https://dolarapi.com/v1/cotizaciones/eur", {
        next: { revalidate: 12 * 60 * 60 },
      }),
    ]);
    if (!usdRes.ok || !eurRes.ok) throw new Error("api status not ok");
    const usd = (await usdRes.json()) as DolarApiItem;
    const eur = (await eurRes.json()) as DolarApiItem;
    return {
      USD: Math.round((usd.compra + usd.venta) / 2),
      EUR: Math.round((eur.compra + eur.venta) / 2),
      source: "live",
      fetchedAt: usd.fechaActualizacion ?? new Date().toISOString(),
    };
  } catch {
    return {
      USD: FALLBACK.USD,
      EUR: FALLBACK.EUR,
      source: "fallback",
      fetchedAt: new Date().toISOString(),
    };
  }
}
