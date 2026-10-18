"use client";

/**
 * «Tus cuentas» en el portal del cliente (17/10/2026, pedido de Luz): red por
 * red, si la tiene y con qué usuario y contraseña. Lo que no tiene, lo crea el
 * equipo (se le arma la tarea sola). Las contraseñas nunca vuelven a mostrarse:
 * solo se ve qué redes ya están cargadas.
 */
import { useState } from "react";
import { Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { REDES, type Red } from "@/lib/accesos/portal";
import { cn } from "@/lib/utils";

type Estado = "cargada" | "sin_cuenta" | "falta";
interface Fila { tiene: boolean | null; usuario: string; password: string; ver: boolean }

export function PortalAccesos({ token, estado }: { token: string; estado: Record<Red, Estado> }) {
  const [filas, setFilas] = useState<Record<Red, Fila>>(
    () => Object.fromEntries(REDES.map((r) => [r.clave, { tiene: estado[r.clave] === "sin_cuenta" ? false : estado[r.clave] === "cargada" ? true : null, usuario: "", password: "", ver: false }])) as Record<Red, Fila>
  );
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<{ ok: boolean; texto: string } | null>(null);
  const [cargadas, setCargadas] = useState(estado);

  const set = (red: Red, cambio: Partial<Fila>) => setFilas((f) => ({ ...f, [red]: { ...f[red], ...cambio } }));

  async function guardar() {
    const items = REDES.filter((r) => filas[r.clave].tiene !== null)
      .map((r) => ({ red: r.clave, tiene: !!filas[r.clave].tiene, usuario: filas[r.clave].usuario, password: filas[r.clave].password }))
      .filter((i) => !i.tiene || i.usuario || i.password);
    if (!items.length) {
      setAviso({ ok: false, texto: "Completá al menos una cuenta." });
      return;
    }
    setGuardando(true);
    setAviso(null);
    try {
      const res = await fetch(`/api/c/${token}/accesos`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "No se pudo guardar.");
      const nuevo = { ...cargadas };
      for (const i of items) nuevo[i.red] = i.tiene ? "cargada" : "sin_cuenta";
      setCargadas(nuevo);
      setFilas((f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, { ...v, password: "" }])) as Record<Red, Fila>);
      setAviso({ ok: true, texto: "¡Listo! Ya le llegó a tu equipo. Las cuentas que no tenés, las creamos nosotros." });
    } catch (e) {
      setAviso({ ok: false, texto: e instanceof Error ? e.message : "No se pudo guardar." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className="space-y-3">
      {REDES.map((r) => {
        const f = filas[r.clave];
        return (
          <div key={r.clave} className="rounded-xl border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <b className="text-sm">{r.nombre}</b>
                {cargadas[r.clave] === "cargada" && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                    <Check className="h-3 w-3" /> Cargada
                  </span>
                )}
                {cargadas[r.clave] === "sin_cuenta" && (
                  <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[11px] font-semibold text-amber-800">La creamos nosotros</span>
                )}
              </div>
              <div className="flex overflow-hidden rounded-full border text-xs font-semibold">
                <button type="button" onClick={() => set(r.clave, { tiene: true })} className={cn("px-3 py-1.5", f.tiene === true ? "bg-black text-[#FFD400]" : "bg-white text-black/60")}>La tengo</button>
                <button type="button" onClick={() => set(r.clave, { tiene: false })} className={cn("px-3 py-1.5", f.tiene === false ? "bg-black text-[#FFD400]" : "bg-white text-black/60")}>No la tengo</button>
              </div>
            </div>
            {f.tiene && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <input
                  className="rounded-lg border px-3 py-2 text-sm"
                  placeholder={cargadas[r.clave] === "cargada" ? "Usuario (ya cargado, podés cambiarlo)" : "Usuario o mail"}
                  autoComplete="off"
                  value={f.usuario}
                  onChange={(e) => set(r.clave, { usuario: e.target.value })}
                />
                <div className="relative">
                  <input
                    className="w-full rounded-lg border px-3 py-2 pr-9 text-sm"
                    placeholder={cargadas[r.clave] === "cargada" ? "Contraseña (dejala vacía si no cambió)" : "Contraseña"}
                    type={f.ver ? "text" : "password"}
                    autoComplete="new-password"
                    value={f.password}
                    onChange={(e) => set(r.clave, { password: e.target.value })}
                  />
                  <button type="button" onClick={() => set(r.clave, { ver: !f.ver })} className="absolute right-2 top-1/2 -translate-y-1/2 text-black/40" aria-label={f.ver ? "Ocultar contraseña" : "Mostrar contraseña"}>
                    {f.ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            )}
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-bold text-[#FFD400] disabled:opacity-60"
        >
          {guardando && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar mis cuentas
        </button>
        {aviso && <span className={cn("text-sm", aviso.ok ? "text-emerald-700" : "text-rose-600")}>{aviso.texto}</span>}
      </div>
      <p className="text-xs text-black/50">Solo lo ve tu equipo de JD Media. Nunca te vamos a pedir tus contraseñas por otro lado.</p>
    </div>
  );
}
