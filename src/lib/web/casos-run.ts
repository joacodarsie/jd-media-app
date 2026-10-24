/**
 * Los casos de éxito (el antes y después de las cuentas), contra la base. Lo
 * usan la web (/api/web/antes-despues) y la propuesta (hoja «Resultados
 * reales», 24/10/2026). Solo cuentas con `mostrar_en_web`.
 */
import { unstable_cache } from "next/cache";
import { createAdmin } from "@/lib/supabase/admin";
import { cargarCrecimiento } from "@/lib/crecimiento/cargar";
import type { CasoConRubro } from "@/lib/propuestas/casos";
import { elegirCasos, type CandidatoCaso } from "./vitrina";

export const cargarCasos = unstable_cache(
  async (): Promise<CasoConRubro[]> => {
    const admin = createAdmin();
    const { data } = await admin
      .from("clients")
      .select("id, nombre, rubro")
      .eq("estado", "activo")
      .eq("es_interno", false)
      .eq("mostrar_en_web", true);
    const lista = (data ?? []) as { id: string; nombre: string; rubro: string | null }[];
    const candidatos: CandidatoCaso[] = await Promise.all(
      lista.map(async (c) => {
        const d = await cargarCrecimiento(admin, c.id);
        return {
          nombre: c.nombre,
          usuario: d.hoy?.usuario ?? d.inicio?.usuario ?? null,
          meses: d.meses,
          antes: d.inicio ? { fecha: d.inicio.fecha, grilla: d.inicio.grilla } : null,
          hoy: d.hoy ? { fecha: d.hoy.fecha, grilla: d.hoy.grilla } : null,
          comparaciones: d.comparaciones,
        };
      })
    );
    const rubroDe = new Map(lista.map((c) => [c.nombre, c.rubro]));
    return elegirCasos(candidatos).map((c) => ({ ...c, rubro: rubroDe.get(c.nombre) ?? null }));
  },
  ["web-antes-despues-v6"],
  { revalidate: 21_600 }
);
