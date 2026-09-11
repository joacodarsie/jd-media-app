import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SectionTabs } from "@/components/section-tabs";
import { equipoTabs } from "@/lib/section-tabs";
import { OrganigramaArbol, type Cargas } from "@/components/organigrama-arbol";
import {
  DECISIONES_ABIERTAS,
  ORGANIGRAMA,
  agruparPorArea,
  calcularCarga,
  resolverOrganigrama,
} from "@/lib/organigrama/estructura";

export const dynamic = "force-dynamic";

/** Cuentas que siguen vivas: las tareas de un cliente perdido no son deuda. */
const ESTADOS_VIVOS = ["activo", "at_risk", "esperando_pago"];

export default async function OrganigramaPage() {
  const me = await requireUser();
  const supabase = createClient();

  const [usuariosRes, clientesRes, tareasRes] = await Promise.all([
    supabase
      .from("users")
      .select("id, nombre, rol, area, area_secundaria")
      .eq("activo", true)
      .order("nombre"),
    supabase.from("clients").select("id").in("estado", ESTADOS_VIVOS),
    supabase
      .from("tasks")
      .select("asignado_a_id, estado, fecha_limite, cliente_id")
      .not("estado", "in", "(completada,archivada)"),
  ]);

  const usuarios = (usuariosRes.data ?? []) as Array<{
    id: string;
    nombre: string;
    rol: string | null;
    area: string | null;
    area_secundaria: string | null;
  }>;
  const vivos = new Set(((clientesRes.data ?? []) as Array<{ id: string }>).map((c) => c.id));
  const tareas = (tareasRes.data ?? []) as Array<{
    asignado_a_id: string | null;
    estado: string;
    fecha_limite: string | null;
    cliente_id: string | null;
  }>;

  const raiz = resolverOrganigrama(ORGANIGRAMA, agruparPorArea(usuarios));
  const cargas: Cargas = Object.fromEntries(
    calcularCarga(tareas, vivos, new Date().toISOString())
  );

  // Quién quedó afuera del organigrama: si alguien tiene un área que no figura
  // en ninguna caja, no aparece por ningún lado y es fácil no darse cuenta.
  const ubicados = new Set<string>();
  const recorrer = (n: typeof raiz) => {
    for (const p of n.gente) ubicados.add(p.id);
    n.hijos?.forEach(recorrer);
  };
  recorrer(raiz);
  const sinPuesto = usuarios.filter((u) => !ubicados.has(u.id));

  return (
    <div className="space-y-6">
      <SectionTabs tabs={equipoTabs(me.rol, me.rol_secundario)} />

      <div>
        <h1 className="text-2xl font-bold">Organigrama</h1>
        <p className="text-muted-foreground">
          Tocá cualquier puesto para ver de qué responde y dónde se hace ese
          trabajo. Las personas se acomodan solas según el área que tengan
          cargada en Accesos.
        </p>
      </div>

      <OrganigramaArbol raiz={raiz} cargas={cargas} />

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-1 text-sm font-semibold">Quien coordina, no ejecuta</h2>
          <p className="text-sm text-muted-foreground">
            Es la regla que ordena todo el esquema. Quien controla los tiempos no
            puede ser la misma persona que produce el contenido: cuando se
            atrasa, se atrasa a sí misma y nadie lo ve.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-1 text-sm font-semibold">Cada cuenta tiene un dueño</h2>
          <p className="text-sm text-muted-foreground">
            El motivo de fondo de la reestructura: se fueron 24 de 39 clientes
            porque nadie respondía por el resultado de una cuenta. Por eso cada
            caja dice de qué responde.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-1 text-sm font-semibold">Las líneas punteadas</h2>
          <p className="text-sm text-muted-foreground">
            Paid Media, Comercial, Botly y Desarrollo Web corren en paralelo: no
            cuelgan de Operaciones. Operaciones les pide el servicio cuando una
            cuenta lo tiene contratado.
          </p>
        </div>
      </div>

      {sinPuesto.length > 0 && (
        <div className="rounded-xl border border-dashed bg-card p-4">
          <h2 className="mb-1 text-sm font-semibold">Sin puesto en el organigrama</h2>
          <p className="mb-2 text-sm text-muted-foreground">
            Su área no coincide con ninguna caja. Se arregla cambiándoles el área
            en Accesos.
          </p>
          <ul className="text-sm">
            {sinPuesto.map((u) => (
              <li key={u.id}>
                <span className="font-medium">{u.nombre}</span>
                <span className="text-muted-foreground"> — {u.area ?? "sin área"}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-xl border bg-card p-4">
        <h2 className="mb-1 text-sm font-semibold">Todavía sin decidir</h2>
        <p className="mb-2 text-sm text-muted-foreground">
          Lo que falta cerrar para que el esquema quede firme.
        </p>
        <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
          {DECISIONES_ABIERTAS.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
