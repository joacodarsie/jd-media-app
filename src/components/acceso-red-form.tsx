"use client";

/**
 * Un acceso del arranque, red por red (20/10/2026): link, usuario, contraseña
 * y notas en la misma fila del paso. Con link y usuario el paso se marca solo;
 * «No tiene esta red» también lo da por resuelto.
 */
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { guardarAccesoRed } from "@/app/(app)/clientes/[id]/onboarding/actions";
import type { RedOnboarding } from "@/lib/accesos/redes-onboarding";

export function AccesoRedForm({
  clientId,
  red,
  ejemploUrl,
  inicial,
}: {
  clientId: string;
  red: RedOnboarding;
  ejemploUrl: string;
  inicial: { url: string; usuario: string; tienePassword: boolean; notas: string; noTiene: boolean };
}) {
  const router = useRouter();
  const [url, setUrl] = useState(inicial.url);
  const [usuario, setUsuario] = useState(inicial.usuario);
  const [password, setPassword] = useState("");
  const [ver, setVer] = useState(false);
  const [notas, setNotas] = useState(inicial.notas);
  const [pendiente, empezar] = useTransition();

  const guardar = (noTiene = false) =>
    empezar(async () => {
      const r = await guardarAccesoRed(clientId, red, { url, usuario, password, notas, noTiene });
      if ("error" in r && r.error) return void toast.error(r.error);
      toast.success(noTiene ? "Anotado: no tiene esta red." : url.trim() && usuario.trim() ? "Acceso guardado: paso listo." : "Guardado. Falta el link o el usuario para darlo por listo.");
      setPassword("");
      router.refresh();
    });

  if (inicial.noTiene)
    return (
      <div className="flex w-full flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>El cliente no tiene esta red{inicial.notas ? ` · ${inicial.notas}` : ""}.</span>
        <button type="button" className="font-medium text-primary hover:underline" onClick={() => guardar(false)} disabled={pendiente}>
          Ahora sí la tiene
        </button>
      </div>
    );

  return (
    <form
      className="grid w-full gap-2 rounded-md border bg-muted/20 p-2.5 sm:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        guardar(false);
      }}
    >
      <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={`Link (${ejemploUrl})`} className="h-9 text-sm" aria-label="Link de la cuenta" />
      <Input value={usuario} onChange={(e) => setUsuario(e.target.value)} placeholder="Usuario o email" className="h-9 text-sm" aria-label="Usuario" />
      <div className="relative">
        <Input
          type={ver ? "text" : "password"}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={inicial.tienePassword ? "Contraseña guardada (dejala vacía si no cambió)" : "Contraseña"}
          className="h-9 pr-9 text-sm"
          aria-label="Contraseña"
          autoComplete="new-password"
        />
        <button type="button" onClick={() => setVer(!ver)} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground" aria-label={ver ? "Ocultar contraseña" : "Mostrar contraseña"}>
          {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      <Input value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas (2FA, quién tiene el código…)" className="h-9 text-sm" aria-label="Notas" />
      <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
        <Button type="submit" size="sm" disabled={pendiente}>
          {pendiente && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />} Guardar
        </Button>
        <button type="button" onClick={() => guardar(true)} disabled={pendiente} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          No tiene esta red
        </button>
      </div>
    </form>
  );
}
