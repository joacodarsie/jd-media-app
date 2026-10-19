"use client";

/**
 * «Tus datos» y «Tu acceso» en Mi perfil (19/10/2026, 0209): nombre completo,
 * teléfono, datos de facturación y confirmar que sabés con qué mail y
 * contraseña entrás (con el cambio de contraseña a mano).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { confirmarMiAcceso, updateMisDatos } from "@/app/(app)/mi-perfil/actions";
import { createClient } from "@/lib/supabase/client";

const CONDICIONES = [
  { v: "", l: "Elegí una opción" },
  { v: "monotributo", l: "Monotributo" },
  { v: "responsable_inscripto", l: "Responsable inscripto" },
  { v: "relacion_dependencia", l: "Relación de dependencia" },
  { v: "ninguna", l: "Todavía no facturo" },
];

export function MisDatosCard(props: {
  nombre: string;
  telefono: string | null;
  dniCuit: string | null;
  condicionFiscal: string | null;
  domicilio: string | null;
}) {
  const router = useRouter();
  const [f, setF] = useState({
    nombre: props.nombre,
    telefono: props.telefono ?? "",
    dniCuit: props.dniCuit ?? "",
    condicionFiscal: props.condicionFiscal ?? "",
    domicilio: props.domicilio ?? "",
  });
  const [guardando, setGuardando] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setGuardando(true);
    const r = await updateMisDatos({
      nombre: f.nombre,
      telefono: f.telefono || null,
      dniCuit: f.dniCuit || null,
      condicionFiscal: f.condicionFiscal || null,
      domicilio: f.domicilio || null,
    });
    setGuardando(false);
    if ("error" in r && r.error) return void toast.error(r.error);
    toast.success("¡Datos guardados!");
    router.refresh();
  }

  return (
    <Card id="datos" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="text-base">Tus datos</CardTitle>
        <p className="text-xs text-muted-foreground">
          Los de facturación todavía no se usan, pero los pedimos ahora para tenerlos el día que haga falta. Solo los ve la dirección.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={guardar} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="md-nombre">Nombre y apellido</Label>
            <Input id="md-nombre" value={f.nombre} onChange={set("nombre")} placeholder="Como figura en tu documento" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md-tel">Teléfono</Label>
            <Input id="md-tel" value={f.telefono} onChange={set("telefono")} placeholder="+54 9 351 555 5555" inputMode="tel" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md-doc">DNI o CUIT</Label>
            <Input id="md-doc" value={f.dniCuit} onChange={set("dniCuit")} placeholder="20-12345678-9" inputMode="numeric" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md-cond">Condición fiscal</Label>
            <select id="md-cond" value={f.condicionFiscal} onChange={set("condicionFiscal")} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {CONDICIONES.map((c) => (
                <option key={c.v} value={c.v}>
                  {c.l}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="md-dom">Domicilio</Label>
            <Input id="md-dom" value={f.domicilio} onChange={set("domicilio")} placeholder="Calle, número, ciudad" />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Guardar mis datos
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function MiAccesoCard({ email, confirmado }: { email: string; confirmado: boolean }) {
  const router = useRouter();
  const [nueva, setNueva] = useState("");
  const [cambiando, setCambiando] = useState(false);
  const [listo, setListo] = useState(confirmado);

  async function cambiar(e: React.FormEvent) {
    e.preventDefault();
    if (nueva.length < 8) return void toast.error("La contraseña tiene que tener al menos 8 caracteres.");
    setCambiando(true);
    const { error } = await createClient().auth.updateUser({ password: nueva });
    setCambiando(false);
    if (error) return void toast.error("No se pudo cambiar: " + error.message);
    setNueva("");
    toast.success("Contraseña cambiada. Anotala en un lugar seguro.");
  }

  async function confirmar() {
    const r = await confirmarMiAcceso();
    if ("error" in r && r.error) return void toast.error(r.error);
    setListo(true);
    toast.success("¡Listo!");
    router.refresh();
  }

  return (
    <Card id="acceso" className="scroll-mt-20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <KeyRound className="h-4 w-4" /> Tu acceso
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          <div className="text-xs text-muted-foreground">Entrás con este mail</div>
          <div className="font-semibold">{email}</div>
        </div>
        <form onSubmit={cambiar} className="flex flex-wrap items-end gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="acc-pass">Elegí una contraseña nueva (si no la recordás)</Label>
            <Input id="acc-pass" type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} placeholder="Mínimo 8 caracteres" autoComplete="new-password" />
          </div>
          <Button type="submit" variant="outline" disabled={cambiando || !nueva}>
            {cambiando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Cambiar
          </Button>
        </form>
        {listo ? (
          <p className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
            <Check className="h-4 w-4" /> Confirmaste que tenés anotados tu mail y tu contraseña.
          </p>
        ) : (
          <Button onClick={confirmar} className="w-full sm:w-auto">
            Ya tengo anotados mi mail y mi contraseña
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
