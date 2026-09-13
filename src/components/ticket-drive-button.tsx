"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FolderOpen, Loader2 } from "lucide-react";
import { ensureDriveFolder } from "@/app/(app)/tareas/actions";
import { Button } from "@/components/ui/button";

/**
 * La carpeta de Drive del ticket, en un botón.
 *
 * Si ya existe, abre. Si no, la crea y abre. Es el mismo botón en los dos casos
 * a propósito: al diseñador no le importa si existía, le importa llegar a la
 * carpeta donde sube las placas.
 *
 * Normalmente la carpeta ya está —se crea sola al cargar la primera subtarea—,
 * así que esto cubre el ticket sin desglose y el caso en que Drive falló.
 */
export function TicketDriveButton({
  taskId,
  driveUrl,
}: {
  taskId: string;
  driveUrl: string | null;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [cargando, setCargando] = useState(false);

  async function abrir() {
    if (driveUrl) {
      window.open(driveUrl, "_blank", "noopener");
      return;
    }
    setCargando(true);
    const res = await ensureDriveFolder(taskId);
    setCargando(false);
    if (!res || "error" in res) {
      toast.error(res?.error ?? "No se pudo crear la carpeta.");
      return;
    }
    toast.success(res.creada ? "Carpeta creada en Drive" : "La carpeta ya existía");
    window.open(res.url, "_blank", "noopener");
    startTransition(() => router.refresh());
  }

  return (
    <Button variant="outline" size="sm" onClick={abrir} disabled={cargando} className="gap-1.5">
      {cargando ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <FolderOpen className="h-3.5 w-3.5" />
      )}
      {driveUrl ? "Carpeta en Drive" : "Crear carpeta en Drive"}
    </Button>
  );
}
