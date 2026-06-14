"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { saveMetaAdAccountId } from "@/app/(app)/clientes/[id]/publicidad/actions";

export function MetaAdAccountField({
  clientId,
  initial,
}: {
  clientId: string;
  initial: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? "");
  const [pending, start] = useTransition();

  const dirty = (value.trim() || null) !== (initial?.trim() || null);

  function save() {
    start(async () => {
      const res = await saveMetaAdAccountId(clientId, value);
      if (res?.error) return void toast.error(res.error);
      toast.success("Cuenta publicitaria guardada.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="act_1234567890"
        className="h-9 flex-1 font-mono text-sm"
      />
      <Button size="sm" onClick={save} disabled={pending || !dirty} className="h-9 gap-1.5">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Guardar
      </Button>
    </div>
  );
}
