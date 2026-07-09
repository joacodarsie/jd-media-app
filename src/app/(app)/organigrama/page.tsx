import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SectionTabs } from "@/components/section-tabs";
import { equipoTabs } from "@/lib/section-tabs";

export const dynamic = "force-dynamic";

interface Person {
  id: string;
  nombre: string;
}
interface OrgNode {
  title: string;
  area: string;
  note?: string;
  children?: OrgNode[];
}

// Estructura curada de la agencia. Las personas se resuelven en vivo por `area`
// (campo users.area), así el organigrama se mantiene actualizado solo.
const ORG: OrgNode = {
  title: "Dirección General",
  area: "Estrategia/Dirección",
  children: [
    { title: "Comercial", area: "Comercial", note: "Cierre de ventas" },
    {
      title: "Coordinación · Gestión de Redes",
      area: "Coordinación",
      note: "Reunión semanal con el equipo · reunión mensual con el cliente",
      children: [
        {
          title: "Coordinación de Diseño",
          area: "Coordinación de Diseño",
          note: "Coordina el servicio de diseño · aprueba la identidad visual en el arranque de cada cuenta",
          children: [{ title: "Diseño gráfico", area: "Diseño" }],
        },
        { title: "Edición audiovisual", area: "Edición Audiovisual" },
        { title: "Community Management", area: "Community Manager" },
        { title: "Paid Media", area: "Paid Media" },
      ],
    },
    { title: "Botly", area: "Botly" },
    { title: "Desarrollo Web", area: "Desarrollo Web" },
  ],
};

function initials(nombre: string) {
  return nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function OrgCard({
  node,
  people,
  ancestorIds,
}: {
  node: OrgNode;
  people: Map<string, Person[]>;
  /** IDs ya listados en nodos ANCESTROS: no se repiten en los hijos. Así quien
   *  coordina un área (p.ej. Brisa en Coordinación de Diseño) no vuelve a
   *  aparecer en el área que coordina (Diseño gráfico). */
  ancestorIds: Set<string>;
}) {
  const team = (people.get(node.area) ?? []).filter((p) => !ancestorIds.has(p.id));
  // Los hijos heredan a los ancestros + los de este nodo.
  const childAncestors = new Set(ancestorIds);
  for (const p of team) childAncestors.add(p.id);
  return (
    <li>
      <div className="org-card">
        <div className="org-title">{node.title}</div>
        {team.length > 0 ? (
          <div className="org-people">
            {team.map((p) => (
              <div key={p.id} className="org-person">
                <span className="org-avatar">{initials(p.nombre)}</span>
                <span className="org-name">{p.nombre}</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="org-vacante">Sin asignar</div>
        )}
        {node.note && <div className="org-note">{node.note}</div>}
      </div>
      {node.children && node.children.length > 0 && (
        <ul>
          {node.children.map((c) => (
            <OrgCard key={c.area + c.title} node={c} people={people} ancestorIds={childAncestors} />
          ))}
        </ul>
      )}
    </li>
  );
}

export default async function OrganigramaPage() {
  const me = await requireUser();
  const supabase = createClient();
  const { data } = await supabase
    .from("users")
    .select("id, nombre, area, area_secundaria, permisos")
    .eq("activo", true)
    .order("nombre");

  const rows = (data ?? []) as Array<{
    id: string;
    nombre: string;
    area: string | null;
    area_secundaria: string | null;
    permisos: Record<string, boolean> | null;
  }>;

  const people = new Map<string, Person[]>();
  const push = (area: string, p: Person) => {
    if (!people.has(area)) people.set(area, []);
    if (!people.get(area)!.some((x) => x.id === p.id)) people.get(area)!.push(p);
  };
  for (const u of rows) {
    push(u.area ?? "Sin área", { id: u.id, nombre: u.nombre });
    // Quien tiene área secundaria también figura ahí.
    if (u.area_secundaria) push(u.area_secundaria, { id: u.id, nombre: u.nombre });
  }
  // Quienes tienen el permiso "comercial" (aunque su área sea otra) también
  // aparecen en Comercial: venden los servicios de la agencia.
  for (const u of rows) {
    if (u.permisos?.comercial) push("Comercial", { id: u.id, nombre: u.nombre });
  }

  // Brisa (Diseño) también lleva las cuentas propias de JD Media.
  const disenio = people.get("Diseño") ?? [];

  return (
    <div className="space-y-6">
      <SectionTabs tabs={equipoTabs(me.rol)} />
      <style>{`
        /* Se ajusta para verse completo sin barra horizontal en pantallas
           normales; en muy chicas, permite scroll como último recurso. */
        .org-wrap { overflow-x: auto; padding: 8px 4px 24px; }
        .tree { display: inline-block; min-width: 100%; text-align: center; }
        @media (min-width: 768px) {
          .org-wrap { overflow-x: visible; }
          .tree { display: block; }
        }
        .tree ul {
          display: flex;
          justify-content: center;
          padding-top: 22px;
          position: relative;
          margin: 0;
          list-style: none;
          transition: all .3s;
        }
        .tree li {
          display: flex;
          flex-direction: column;
          align-items: center;
          list-style: none;
          position: relative;
          padding: 22px 5px 0;
          transition: all .3s;
        }
        /* Conectores */
        .tree li::before, .tree li::after {
          content: '';
          position: absolute;
          top: 0;
          right: 50%;
          border-top: 2px solid hsl(var(--border));
          width: 50%;
          height: 22px;
        }
        .tree li::after {
          right: auto;
          left: 50%;
          border-left: 2px solid hsl(var(--border));
        }
        .tree li:only-child::after, .tree li:only-child::before { display: none; }
        .tree li:only-child { padding-top: 0; }
        .tree li:first-child::before, .tree li:last-child::after { border: 0 none; }
        .tree li:last-child::before {
          border-right: 2px solid hsl(var(--border));
          border-radius: 0 6px 0 0;
        }
        .tree li:first-child::after { border-radius: 6px 0 0 0; }
        .tree ul ul::before {
          content: '';
          position: absolute;
          top: 0;
          left: 50%;
          border-left: 2px solid hsl(var(--border));
          width: 0;
          height: 22px;
        }
        .org-card {
          display: inline-flex;
          flex-direction: column;
          gap: 6px;
          border: 1px solid hsl(var(--border));
          background: hsl(var(--card));
          border-radius: 12px;
          padding: 10px 12px;
          min-width: 148px;
          box-shadow: 0 1px 2px rgba(0,0,0,.04);
        }
        .org-title {
          font-size: 12px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: hsl(var(--muted-foreground));
        }
        .org-people { display: flex; flex-direction: column; gap: 5px; }
        .org-person { display: flex; align-items: center; gap: 8px; }
        .org-avatar {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 26px; height: 26px;
          border-radius: 999px;
          background: #FFD400;
          color: #1a1a1a;
          font-size: 10px;
          font-weight: 800;
          flex: 0 0 auto;
        }
        .org-name { font-size: 13px; font-weight: 600; color: hsl(var(--foreground)); }
        .org-vacante { font-size: 12px; color: hsl(var(--muted-foreground)); font-style: italic; }
        .org-note {
          font-size: 11px;
          color: hsl(var(--muted-foreground));
          border-top: 1px dashed hsl(var(--border));
          padding-top: 5px;
          margin-top: 1px;
          max-width: 170px;
          line-height: 1.35;
        }
        .org-root > .org-card {
          border-color: #FFD400;
          border-width: 2px;
        }
      `}</style>

      <div>
        <h1 className="text-2xl font-bold">Organigrama</h1>
        <p className="text-muted-foreground">
          Estructura del equipo de JD Media. Se actualiza solo según el área de
          cada persona.
        </p>
      </div>

      <div className="org-wrap rounded-xl border bg-card/40 p-4">
        <div className="tree">
          <ul>
            {/* raíz */}
            <li className="org-root">
              <div className="org-card">
                <div className="org-title">{ORG.title}</div>
                <div className="org-people">
                  {(people.get(ORG.area) ?? []).map((p) => (
                    <div key={p.id} className="org-person">
                      <span className="org-avatar">{initials(p.nombre)}</span>
                      <span className="org-name">{p.nombre}</span>
                    </div>
                  ))}
                </div>
                <div className="org-note">Fundador · dirección de la agencia</div>
              </div>
              {ORG.children && (
                <ul>
                  {ORG.children.map((c) => (
                    <OrgCard
                      key={c.area + c.title}
                      node={c}
                      people={people}
                      ancestorIds={new Set((people.get(ORG.area) ?? []).map((p) => p.id))}
                    />
                  ))}
                </ul>
              )}
            </li>
          </ul>
        </div>
      </div>

      {/* Notas estructurales */}
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-1 text-sm font-semibold">Cuenta interna JD Media</h2>
          <p className="text-sm text-muted-foreground">
            Las redes propias de la agencia (Instagram, TikTok, LinkedIn y
            Facebook) las lleva{" "}
            <strong className="text-foreground">
              {disenio[0]?.nombre ?? "Diseño"}
            </strong>
            , que además es responsable del servicio de diseño gráfico.
          </p>
        </div>
        <div className="rounded-xl border bg-card p-4">
          <h2 className="mb-1 text-sm font-semibold">
            Coordinación de Gestión de Redes
          </h2>
          <p className="text-sm text-muted-foreground">
            La coordinadora del servicio se asegura de que todo funcione: hace
            una <strong className="text-foreground">reunión semanal</strong> con
            el equipo (diseño, edición, CM y paid media) y una{" "}
            <strong className="text-foreground">reunión mensual</strong> con cada
            cliente.
          </p>
        </div>
      </div>
    </div>
  );
}
