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
 * Card del onboarding de Gestión de Redes para que la coordinación asigne los
 * puestos del cliente: Community Manager, Diseño y Edición Audiovisual.
 */
export function ClientTeamAssign({
  clientId,
  users,
  initial,
}: {
  clientId: string;
  users: UserOpt[];
  initial: {
    cm_id: string | null;
    disenador_id: string | null;
    audiovisual_id: string | null;
  };
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [cm, setCm] = useState(initial.cm_id ?? NONE);
  const [dis, setDis] = useState(initial.disenador_id ?? NONE);
  const [av, setAv] = useState(initial.audiovisual_id ?? NONE);

  const dirty =
    cm !== (initial.cm_id ?? NONE) ||
    dis !== (initial.disenador_id ?? NONE) ||
    av !== (initial.audiovisual_id ?? NONE);

  function save() {
    start(async () => {
      const res = await assignClientTeam(clientId, {
        cm_id: cm === NONE ? null : cm,
        disenador_id: dis === NONE ? null : dis,
        audiovisual_id: av === NONE ? null : av,
      });
      if (res?.error) return void toast.error(res.error);
      toast.success("Equipo asignado");
      router.refresh();
    });
  }

  const puestos: {
    label: string;
    value: string;
    set: (v: string) => void;
    puesto: Puesto;
  }[] = [
    { label: "Community Manager", value: cm, set: setCm, puesto: "cm" },
    { label: "Diseño gráfico", value: dis, set: setDis, puesto: "diseno" },
    { label: "Edición audiovisual", value: av, set: setAv, puesto: "audiovisual" },
  ];

  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2">
        <Users className="h-4 w-4 text-primary" />
        <h3 className="font-semibold">Equipo de la cuenta</h3>
      </div>
      <p className="mt-1 text-sm text-muted-foreground">
        Elegí quién lleva cada puesto. Las piezas en producción se reasignan solas
        a quien pongas acá.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
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
