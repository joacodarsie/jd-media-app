/**
 * Lo que está atrasado, en una sola línea.
 *
 * Vivía en el hub de Finanzas, que era la pantalla-menú de la que se entraba a
 * otras trece. Al sacar el hub, esto es lo único que valía la pena salvar: es
 * lo que hay que MIRAR, no otra forma de contar el mismo número. Se mudó al
 * Resumen, que es donde ahora se cae por defecto.
 */

export interface AlertaItem {
  fecha: string | null;
  monto: number;
  moneda: string;
  fecha_pago?: string | null;
  fecha_cobro?: string | null;
}

export interface Alerta {
  href: string;
  texto: string;
  monto: number;
  cantidad: number;
}

function atrasados(
  items: AlertaItem[],
  hoy: string,
  pagado: (i: AlertaItem) => boolean,
  aArs: (m: number, moneda: string) => number
) {
  const vencidos = items.filter((i) => !pagado(i) && !!i.fecha && i.fecha < hoy);
  return {
    cantidad: vencidos.length,
    monto: vencidos.reduce((a, i) => a + aArs(Number(i.monto), i.moneda), 0),
  };
}

/**
 * Arma las alertas que tienen algo que decir. Las que están en cero no se
 * devuelven: una tarjeta roja con "0 facturas vencidas" entrena a ignorarla.
 */
export function construirAlertas(
  datos: {
    cobros: AlertaItem[];
    pagos: AlertaItem[];
    gastos: AlertaItem[];
  },
  hoy: string,
  aArs: (m: number, moneda: string) => number
): Alerta[] {
  const out: Alerta[] = [];

  const c = atrasados(datos.cobros, hoy, (i) => !!i.fecha_cobro, aArs);
  if (c.cantidad > 0) {
    out.push({
      href: "/finanzas/cobros?f=vencidas",
      texto: `${c.cantidad} factura${c.cantidad === 1 ? "" : "s"} vencida${
        c.cantidad === 1 ? "" : "s"
      } sin cobrar`,
      ...c,
    });
  }

  const p = atrasados(datos.pagos, hoy, (i) => !!i.fecha_pago, aArs);
  if (p.cantidad > 0) {
    out.push({
      href: "/finanzas/pagos?f=atrasados",
      texto: `${p.cantidad} pago${p.cantidad === 1 ? "" : "s"} atrasado${
        p.cantidad === 1 ? "" : "s"
      } al equipo`,
      ...p,
    });
  }

  const g = atrasados(datos.gastos, hoy, (i) => !!i.fecha_pago, aArs);
  if (g.cantidad > 0) {
    out.push({
      href: "/finanzas/gastos?f=pendientes",
      texto: `${g.cantidad} gasto${g.cantidad === 1 ? "" : "s"} atrasado${
        g.cantidad === 1 ? "" : "s"
      }`,
      ...g,
    });
  }

  return out;
}
