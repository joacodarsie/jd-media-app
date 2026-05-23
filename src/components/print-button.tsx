"use client";

import { Printer } from "lucide-react";

export function PrintButton({ label = "Imprimir / Guardar PDF" }: { label?: string }) {
  return (
    <button
      onClick={() => {
        if (typeof window !== "undefined") window.print();
      }}
      className="inline-flex items-center gap-1.5 rounded-md bg-[#FFD400] px-3 py-1.5 text-xs font-semibold text-black hover:bg-[#FFC700]"
    >
      <Printer className="h-3.5 w-3.5" /> {label}
    </button>
  );
}
