/** Lo que habla con la base para el ritmo del mes (ver ritmo-mes.ts). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ritmoDelMes, type PubRitmo, type RitmoCuenta } from "./ritmo-mes";

const mesMas = (mes: string, n: number) => {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
};

export async function cargarRitmoDelMes(admin: SupabaseClient, hoy: string): Promise<RitmoCuenta[]> {
  const mes = hoy.slice(0, 7);
  const ant = mesMas(mes, -1);
  const sig = `${mesMas(mes, 1)}-01`;
  const { data } = await admin
    .from("publications")
    .select("estado, fecha_publicacion, frenado_cliente, frenado_at, tarea:tasks!publications_task_id_fkey(fecha_completada), cliente:clients!inner(id, nombre, estado, es_interno)")
    .gte("fecha_publicacion", `${ant}-01`)
    .lt("fecha_publicacion", sig)
    .eq("cliente.estado", "activo")
    .eq("cliente.es_interno", false)
    .limit(2000);
  type Fila = {
    estado: string;
    fecha_publicacion: string;
    frenado_cliente: boolean | null;
    frenado_at: string | null;
    tarea: { fecha_completada: string | null } | null;
    cliente: { id: string; nombre: string };
  };
  const filas = (data ?? []) as unknown as Fila[];
  const aPub = (f: Fila): PubRitmo => ({
    clienteId: f.cliente.id,
    cliente: f.cliente.nombre,
    estado: f.estado,
    fecha: f.fecha_publicacion.slice(0, 10),
    frenadoCliente: !!f.frenado_cliente,
  });

  // El mes anterior, a la misma altura: cómo estaba ese día. Lo que salió
  // después todavía no había salido (se sabe por el cierre de la tarea), y lo
  // frenado después todavía no estaba frenado. Comparar contra el mes ya
  // cerrado engaña: lo atrasado termina saliendo y septiembre daba 100%.
  const dia = Math.min(Number(hoy.slice(8, 10)), new Date(Date.UTC(Number(ant.slice(0, 4)), Number(ant.slice(5, 7)), 0)).getUTCDate());
  const mismoDia = `${ant}-${String(dia).padStart(2, "0")}`;
  const previas = filas
    .filter((f) => f.fecha_publicacion.slice(0, 10) < `${mes}-01`)
    .map((f) => {
      const p = aPub(f);
      const cierre = f.tarea?.fecha_completada?.slice(0, 10);
      if (p.estado === "publicado" && cierre && cierre >= mismoDia) p.estado = "edicion";
      if (p.frenadoCliente && f.frenado_at && f.frenado_at.slice(0, 10) >= mismoDia) p.frenadoCliente = false;
      return p;
    });
  const previo = new Map(ritmoDelMes(previas, mismoDia).map((r) => [r.clienteId, r.cumplimiento]));
  return ritmoDelMes(
    filas.filter((f) => f.fecha_publicacion.slice(0, 10) >= `${mes}-01`).map(aPub),
    hoy
  ).map((r) => ({ ...r, anterior: previo.get(r.clienteId) ?? null }));
}
