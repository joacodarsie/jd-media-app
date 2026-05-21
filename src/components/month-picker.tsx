"use client";

import { useRouter } from "next/navigation";
import { Calendar } from "lucide-react";
import { currentPeriod, periodLabel } from "@/lib/finanzas";

/**
 * Selector de mes para filtrar tablas de finanzas. value = null = "Todos".
 * Cambia la URL via buildHref(newMonth | null).
 */
export function MonthPicker({
  value,
  buildHref,
}: {
  value: string | null;
  buildHref: (month: string | null) => string;
}) {
  const router = useRouter();
  const cur = currentPeriod();

  // generar últimos 12 meses + 3 siguientes
  const options: string[] = [];
  const [cy, cm] = cur.split("-").map(Number);
  for (let i = -12; i <= 3; i++) {
    let m = cm + i;
    let y = cy;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    while (m > 12) {
      m -= 12;
      y += 1;
    }
    options.push(`${y}-${String(m).padStart(2, "0")}`);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={value ?? "__all__"}
        onChange={(e) => {
          const v = e.target.value === "__all__" ? null : e.target.value;
          router.push(buildHref(v));
        }}
        className="h-8 rounded-md border bg-card px-2 text-xs"
      >
        <option value="__all__">Todos los meses</option>
        {options.map((m) => (
          <option key={m} value={m}>
            {periodLabel(m)}
          </option>
        ))}
      </select>
    </div>
  );
}
