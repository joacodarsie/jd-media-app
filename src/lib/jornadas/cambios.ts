/**
 * Qué cambió en una jornada (23/10/2026). Cada modificación queda en el
 * historial con una línea por dato: «Viáticos de Carlos: $0 → $20.000».
 * Puro: entran la fila de antes y la de después (columnas de la base).
 */

export interface FilaJornada {
  fecha?: string | null;
  hora_inicio?: string | null;
  horas?: number | string | null;
  monto?: number | string | null;
  cliente_id?: string | null;
  lugar?: string | null;
  notas?: string | null;
  asistentes?: string[] | null;
  viaticos_detalle?: Record<string, number> | null;
  viaticos_los_paga?: string | null;
}

export interface Nombres {
  persona: (id: string) => string;
  cliente: (id: string) => string;
  plata: (n: number) => string;
}

const fechaCorta = (ymd: string) => `${ymd.slice(8, 10)}/${ymd.slice(5, 7)}/${ymd.slice(0, 4)}`;
const vacio = (v: unknown) => v == null || v === "";

export function cambiosJornada(antes: FilaJornada, despues: FilaJornada, n: Nombres): string[] {
  const out: string[] = [];
  const dif = (titulo: string, a: unknown, b: unknown, fmt: (v: never) => string = String) => {
    if ((vacio(a) && vacio(b)) || String(a ?? "") === String(b ?? "")) return;
    out.push(`${titulo}: ${vacio(a) ? "—" : fmt(a as never)} → ${vacio(b) ? "—" : fmt(b as never)}`);
  };
  dif("Fecha", antes.fecha, despues.fecha, fechaCorta);
  dif("Hora", antes.hora_inicio, despues.hora_inicio, (h: string) => `${h} h`);
  if (Number(antes.horas ?? 0) !== Number(despues.horas ?? 0)) dif("Duración", Number(antes.horas), Number(despues.horas), (h: number) => `${h} h`);
  if (Number(antes.monto ?? 0) !== Number(despues.monto ?? 0)) dif("Trabajo", Number(antes.monto), Number(despues.monto), n.plata);
  dif("Cliente", antes.cliente_id, despues.cliente_id, n.cliente);
  dif("Lugar", antes.lugar, despues.lugar);
  const [d0, a0] = antes.asistentes ?? [];
  const [d1, a1] = despues.asistentes ?? [];
  dif("Dirige", d0, d1, n.persona);
  dif("Acompaña", a0, a1, n.persona);
  const va = antes.viaticos_detalle ?? {};
  const vd = despues.viaticos_detalle ?? {};
  for (const id of new Set([...Object.keys(va), ...Object.keys(vd)])) {
    const x = Number(va[id] ?? 0);
    const y = Number(vd[id] ?? 0);
    if (x !== y) out.push(`Viáticos de ${n.persona(id)}: ${n.plata(x)} → ${n.plata(y)}`);
  }
  dif("Viáticos los paga", antes.viaticos_los_paga, despues.viaticos_los_paga, (v: string) => (v === "cliente" ? "el cliente" : "la agencia"));
  dif("Notas", antes.notas, despues.notas, (t: string) => `«${t}»`);
  return out;
}
