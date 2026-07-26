"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Users, Check } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { assignClientTeam } from "@/app/(app)/clientes/[id]/onboarding/actions";
import { usersForPuesto, type Puesto, type TeamUserOpt } from "@/lib/role-options";

const NONE = "__none__";

type UserOpt = TeamUserOpt;

/**
 * Asignación del equipo de una cuenta: quién la coordina y quién cubre cada
 * puesto. Se usa en el onboarding de Gestión de Redes (solo los 3 puestos de
 * producción) y en la ficha del cliente, donde la coordinación también puede
 * cambiar la coordinadora y el gestor de pauta (`full`).
 */
export function ClientTeamAssign({
  clientId,
  users,
  initial,
  full = false,
  titulo,
}: {
  clientId: string;
  users: UserOpt[];
  initial: {
    cm_id: string | null;
    disenador_id: string | null;
    audiovisual_id: string | null;
    media_buyer_id?: string | null;
    coordinador_id?: string | null;
  };
  /** true = suma coordinadora de la cuenta y gestor de pauta. */
  full?: boolean;
  titulo?: string;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cm, setCm] = useState(initial.cm_id ?? NONE);
  const [dis, setDis] = useState(initial.disenador_id ?? NONE);
  const [av, setAv] = useState(initial.audiovisual_id ?? NONE);
  const [mb, setMb] = useState(initial.media_buyer_id ?? NONE);
  const [coord, setCoord] = useState(initial.coordinador_id ?? NONE);

  const dirty =
    cm !== (initial.cm_id ?? NONE) ||
    dis !== (initial.disenador_id ?? NONE) ||
    av !== (initial.audiovisual_id ?? NONE) ||
    (full &&
      (mb !== (initial.media_buyer_id ?? NONE) ||
        coord !== (initial.coordinador_id ?? NONE)));

  function save() {
    start(async () => {
      const res = await assignClientTeam(clientId, {
        cm_id: cm === NONE ? null : cm,
        disenador_id: dis === NONE ? null : dis,
        audiovisual_id: av === NONE ? null : av,
        ...(full
          ? {
              media_buyer_id: mb === NONE ? null : mb,
              coordinador_id: coord === NONE ? null : coord,
            }
          : {}),
      });
      if (res?.error) return void toast.error(res.error);
      toast.success("Equipo actualizado");
      router.refresh();
    });
  }

  const puestos: {
    label: string;
    value: string;
    set: (v: string) => void;
    puesto: Puesto;
  }[] = [
    ...(full
      ? [
          {
            label: "Coordina la cuenta",
            value: coord,
            set: setCoord,
            puesto: "coordinacion" as Puesto,
          },
        ]
      : []),
    { label: "Community Manager", value: cm, set: setCm, puesto: "cm" },
    { label: "Diseño gráfico", value: dis, set: setDis, puesto: "diseno" },
    { label: "Edición audiovisual", value: av, set: setAv, puesto: "audiovisual" },
    ...(full
      ? [{ label: "Gestor de pauta", value: mb, set: setMb, puesto: "pauta" as Puesto }]
      : []),
  ];

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">{titulo ?? "Equipo de la cuenta"}</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Elegí quién lleva cada puesto. Las piezas en producción se reasignan solas
        a quien pongas acá.
      </p>
      <div className={`mt-3 grid gap-3 ${full ? "sm:grid-cols-2" : "sm:grid-cols-3"}`}>
        {puestos.map((p) => (
          <div key={p.label}>
            <Label className="text-xs">{p.label}</Label>
            <Select value={p.value} onValueChange={p.set}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Sin asignar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>Sin asignar</SelectItem>
                {usersForPuesto(users, p.puesto, p.value === NONE ? null : p.value).map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end">
        <Button onClick={save} disabled={pending || !dirty} size="sm">
          {pending ? (
            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
          ) : (
            <Check className="mr-1.5 h-4 w-4" />
          )}
          Guardar equipo
        </Button>
      </div>
    </div>
  );
}
