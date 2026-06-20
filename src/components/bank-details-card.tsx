"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Landmark } from "lucide-react";
import { updateMyBankDetails } from "@/app/(app)/mi-perfil/actions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

/**
 * Autoservicio: cada colaborador carga/edita sus propios datos bancarios para
 * que figuren en su sueldo y en el mensaje de pago. Sin pasar por un admin.
 */
export function BankDetailsCard({
  initialAlias,
  initialCbu,
  initialTitular,
}: {
  initialAlias: string | null;
  initialCbu: string | null;
  initialTitular: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [alias, setAlias] = useState(initialAlias ?? "");
  const [cbu, setCbu] = useState(initialCbu ?? "");
  const [titular, setTitular] = useState(initialTitular ?? "");

  const dirty =
    alias !== (initialAlias ?? "") ||
    cbu !== (initialCbu ?? "") ||
    titular !== (initialTitular ?? "");

  const falta = !alias.trim() && !cbu.trim();

  function save() {
    start(async () => {
      const res = await updateMyBankDetails({
        alias: alias || null,
        cbu: cbu || null,
        titular: titular || null,
      });
      if (res?.error) return void toast.error(res.error);
      toast.success("Datos bancarios guardados.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Landmark className="h-4 w-4" /> Mis datos para cobrar
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Cargá tu alias o CBU para que aparezca en tu sueldo y donde se registra
          tu pago. Solo lo ve Dirección.
        </p>
        {falta && (
          <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:bg-amber-950/30 dark:text-amber-300">
            Todavía no cargaste tu alias/CBU. Sin esto, no se sabe a dónde
            transferirte.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="bank-alias">Alias</Label>
            <Input
              id="bank-alias"
              value={alias}
              onChange={(e) => setAlias(e.target.value)}
              placeholder="ej: mi.alias.mp"
            />
          </div>
          <div>
            <Label htmlFor="bank-titular">Titular de la cuenta</Label>
            <Input
              id="bank-titular"
              value={titular}
              onChange={(e) => setTitular(e.target.value)}
              placeholder="Nombre y apellido"
            />
          </div>
        </div>
        <div>
          <Label htmlFor="bank-cbu">CBU (opcional)</Label>
          <Input
            id="bank-cbu"
            value={cbu}
            onChange={(e) => setCbu(e.target.value)}
            placeholder="22 dígitos"
            inputMode="numeric"
          />
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={save} disabled={pending || !dirty}>
            {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
