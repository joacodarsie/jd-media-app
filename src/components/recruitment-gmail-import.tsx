"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Trae CVs desde Gmail para una búsqueda. Usa la casilla conectada de la agencia.
 * La query es de Gmail (ej: 'has:attachment filename:pdf newer_than:90d'); se
 * puede afinar (ej: agregar el asunto de la búsqueda).
 */
export function RecruitmentGmailImport({
  searchId,
  connected,
}: {
  searchId: string;
  connected: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("has:attachment filename:pdf newer_than:90d");

  async function importNow() {
    setBusy(true);
    try {
      const res = await fetch(`/api/reclutamiento/${searchId}/gmail-import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, max: 15 }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(json.error ?? `Error ${res.status}`);
        return;
      }
      if (json.ok > 0) toast.success(`${json.ok} CV(s) traídos de Gmail y analizados.`);
      else toast.message("No se encontraron CVs nuevos con esa búsqueda.");
      if (json.skipped > 0) toast.message(`${json.skipped} ya estaban cargados.`);
      if (Array.isArray(json.errors) && json.errors.length > 0) {
        console.warn("Gmail import errors:", json.errors);
      }
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  if (!connected) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2">
      <Mail className="ml-1 h-4 w-4 shrink-0 text-primary" />
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-9 min-w-52 flex-1 font-mono text-xs"
        placeholder="Búsqueda de Gmail"
      />
      <Button onClick={importNow} disabled={busy} size="sm" className="gap-1.5">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
        {busy ? "Trayendo…" : "Traer de Gmail"}
      </Button>
    </div>
  );
}
