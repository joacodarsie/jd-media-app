"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, ListChecks, Users } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  iniciales,
  type CargaPersona,
  type NodoResuelto,
} from "@/lib/organigrama/estructura";

/** Carga de cada persona, por id. Viene calculada del server. */
export type Cargas = Record<string, CargaPersona>;

/**
 * El CSS del árbol.
 *
 * Va con `dangerouslySetInnerHTML` a propósito: como JSX, React escapa las
 * comillas de `content: ''` a `&#x27;` en el HTML del server pero no en el del
 * cliente, y eso rompe la hidratación de toda la página.
 */
const CSS = `
.org-wrap { overflow-x: auto; padding: 8px 4px 24px; }
.tree { display: inline-block; min-width: 100%; text-align: center; }
.tree ul {
  display: flex;
  justify-content: center;
  padding-top: 22px;
  position: relative;
  margin: 0;
  list-style: none;
}
.tree li {
  display: flex;
  flex-direction: column;
  align-items: center;
  list-style: none;
  position: relative;
  padding: 22px 4px 0;
}
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
  text-align: left;
  border: 1px solid hsl(var(--border));
  background: hsl(var(--card));
  border-radius: 12px;
  padding: 10px 12px;
  min-width: 148px;
  max-width: 172px;
  box-shadow: 0 1px 2px rgba(0,0,0,.04);
  cursor: pointer;
  transition: border-color .15s, box-shadow .15s, transform .15s;
}
.org-card:hover {
  border-color: #FFD400;
  box-shadow: 0 4px 12px rgba(0,0,0,.08);
  transform: translateY(-1px);
}
.org-card:focus-visible { outline: 2px solid #FFD400; outline-offset: 2px; }
/* Las áreas que NO cuelgan de operaciones van punteadas: se ve de un vistazo
   que corren en paralelo y tienen su propia entrega. */
.org-paralelo { border-style: dashed; }
.org-title {
  font-size: 11px;
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
.org-vencidas {
  margin-left: auto;
  font-size: 10px;
  font-weight: 800;
  line-height: 1;
  padding: 3px 6px;
  border-radius: 999px;
  background: hsl(var(--destructive) / .12);
  color: hsl(var(--destructive));
}
.org-vacante { font-size: 12px; color: hsl(var(--muted-foreground)); font-style: italic; }
.org-responde {
  font-size: 11px;
  color: hsl(var(--muted-foreground));
  border-top: 1px dashed hsl(var(--border));
  padding-top: 5px;
  line-height: 1.35;
}
.org-root > .org-card { border-color: #FFD400; border-width: 2px; }
.org-fila { display: flex; flex-wrap: wrap; gap: 10px; }
`;

function Persona({ nombre, carga }: { nombre: string; carga?: CargaPersona }) {
  // Todo span: esta tarjeta vive dentro de un <button> y un <div> ahí adentro
  // es HTML inválido.
  return (
    <span className="org-person">
      <span className="org-avatar">{iniciales(nombre)}</span>
      <span className="org-name">{nombre}</span>
      {carga && carga.vencidas > 0 && (
        <span className="org-vencidas" title={`${carga.vencidas} tareas vencidas`}>
          {carga.vencidas}
        </span>
      )}
    </span>
  );
}

function Caja({
  nodo,
  cargas,
  onAbrir,
}: {
  nodo: NodoResuelto;
  cargas: Cargas;
  onAbrir: (n: NodoResuelto) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(nodo)}
      className={`org-card ${nodo.paralelo ? "org-paralelo" : ""}`}
      aria-label={`Ver el detalle de ${nodo.titulo}`}
    >
      <span className="org-title">{nodo.titulo}</span>
      {nodo.gente.length > 0 ? (
        <span className="org-people">
          {nodo.gente.map((p) => (
            <Persona key={p.id} nombre={p.nombre} carga={cargas[p.id]} />
          ))}
        </span>
      ) : (
        <span className="org-vacante">Sin asignar</span>
      )}
      <span className="org-responde">{nodo.respondePor}</span>
    </button>
  );
}

function Rama({
  nodo,
  cargas,
  onAbrir,
  raiz,
}: {
  nodo: NodoResuelto;
  cargas: Cargas;
  onAbrir: (n: NodoResuelto) => void;
  raiz?: boolean;
}) {
  const hijos = (nodo.hijos ?? []).filter((h) => !h.aparte);
  return (
    <li className={raiz ? "org-root" : undefined}>
      <Caja nodo={nodo} cargas={cargas} onAbrir={onAbrir} />
      {hijos.length > 0 && (
        <ul>
          {hijos.map((h) => (
            <Rama key={h.id} nodo={h} cargas={cargas} onAbrir={onAbrir} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function OrganigramaArbol({
  raiz,
  cargas,
}: {
  raiz: NodoResuelto;
  cargas: Cargas;
}) {
  const [abierto, setAbierto] = useState<NodoResuelto | null>(null);
  const aparte = (raiz.hijos ?? []).filter((h) => h.aparte);

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="org-wrap rounded-xl border bg-card/40 p-4">
        <div className="tree">
          <ul>
            <Rama nodo={raiz} cargas={cargas} onAbrir={setAbierto} raiz />
          </ul>
        </div>
      </div>

      {aparte.length > 0 && (
        <div className="rounded-xl border bg-card/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Servicios propios
          </p>
          <div className="org-fila">
            {aparte.map((n) => (
              <Caja key={n.id} nodo={n} cargas={cargas} onAbrir={setAbierto} />
            ))}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            Tienen su propio cliente y su propia entrega: no pasan por el
            circuito de contenido.
          </p>
        </div>
      )}

      <Sheet open={abierto !== null} onOpenChange={(o) => !o && setAbierto(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
          {abierto && (
            <div className="space-y-5">
              <div>
                <SheetTitle className="text-xl">{abierto.titulo}</SheetTitle>
                {abierto.paralelo && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Área en paralelo: no cuelga de Operaciones.
                  </p>
                )}
              </div>

              <div className="rounded-lg border-l-4 border-l-[#FFD400] bg-muted/40 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Responde por
                </p>
                <p className="mt-1 text-sm font-medium">{abierto.respondePor}</p>
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  <Users className="h-3.5 w-3.5" /> Quién lo ocupa
                </p>
                {abierto.gente.length > 0 ? (
                  <ul className="space-y-1.5">
                    {abierto.gente.map((p) => {
                      const carga = cargas[p.id];
                      return (
                        <li key={p.id}>
                          <Link
                            href={`/equipo/persona/${p.id}`}
                            className="flex items-center gap-2.5 rounded-lg border p-2 transition-colors hover:bg-accent"
                          >
                            <span className="org-avatar">{iniciales(p.nombre)}</span>
                            <span className="flex-1 text-sm font-medium">{p.nombre}</span>
                            {carga && (
                              <span className="text-xs text-muted-foreground">
                                {carga.abiertas} abiertas
                                {carga.vencidas > 0 && (
                                  <span className="ml-1.5 font-semibold text-destructive">
                                    {carga.vencidas} vencidas
                                  </span>
                                )}
                              </span>
                            )}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="text-sm italic text-muted-foreground">
                    Nadie tiene esta área asignada todavía.
                  </p>
                )}
              </div>

              <p className="text-sm leading-relaxed text-muted-foreground">{abierto.resumen}</p>

              {abierto.responsabilidades && abierto.responsabilidades.length > 0 && (
                <div>
                  <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    <ListChecks className="h-3.5 w-3.5" /> Tiene a cargo, siempre
                  </p>
                  <ul className="space-y-1 rounded-lg border p-3">
                    {abierto.responsabilidades.map((r) => (
                      <li key={r} className="flex gap-2 text-sm">
                        <span className="mt-[7px] h-1 w-1 flex-none rounded-full bg-muted-foreground" />
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    No son tareas: no se terminan nunca, así que no llevan fecha.
                  </p>
                </div>
              )}

              {abierto.notas && abierto.notas.length > 0 && (
                <ul className="space-y-2">
                  {abierto.notas.map((n) => (
                    <li key={n} className="flex gap-2 text-sm text-muted-foreground">
                      <CircleAlert className="mt-0.5 h-4 w-4 flex-none text-[#c79a00]" />
                      <span>{n}</span>
                    </li>
                  ))}
                </ul>
              )}

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Dónde se hace
                </p>
                <ul className="space-y-1.5">
                  {abierto.tareas.map((t) => (
                    <li key={t.href + t.label}>
                      <Link
                        href={t.href}
                        onClick={() => setAbierto(null)}
                        className="group flex items-start gap-2 rounded-lg border p-2.5 transition-colors hover:bg-accent"
                      >
                        <span className="flex-1">
                          <span className="block text-sm font-medium">{t.label}</span>
                          <span className="block text-xs text-muted-foreground">{t.detalle}</span>
                        </span>
                        <ArrowRight className="mt-0.5 h-4 w-4 flex-none text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
