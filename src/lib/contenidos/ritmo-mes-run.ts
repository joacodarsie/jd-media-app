/** Lo que habla con la base para el ritmo del mes (ver ritmo-mes.ts). */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ritmoDelMes, type PubRitmo, type RitmoCuenta } from "./ritmo-mes";

export async function cargarRitmoDelMes(admin: SupabaseClient, hoy: string): Promise<RitmoCuenta[]> {
  const mes = hoy.slice(0, 7);
  const [y, m] = mes.split("-").map(Number);
  const sig = `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`;
  const { data } = await admin
    .from("publications")
    .select("estado, fecha_publicacion, frenado_cliente, cliente:clients!inner(id, nombre, estado, es_interno)")
    .gte("fecha_publicacion", `${mes}-01`)
    .lt("fecha_publicacion", sig)
    .eq("cliente.estado", "activo")
    .eq("cliente.es_interno", false)
    .limit(1000);
  type Fila = { estado: string; fecha_publicacion: string; frenado_cliente: boolean | null; cliente: { id: string; nombre: string } };
  const pubs: PubRitmo[] = ((data ?? []) as unknown as Fila[]).map((f) => ({
    clienteId: f.cliente.id,
    cliente: f.cliente.nombre,
    estado: f.estado,
    fecha: f.fecha_publicacion.slice(0, 10),
    frenadoCliente: !!f.frenado_cliente,
  }));
  return ritmoDelMes(pubs, hoy);
}
