"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Calendar } from "lucide-react";
import { currentPeriod, periodLabel } from "@/lib/finanzas";

/**
 * Selector de mes para filtrar tablas de finanzas. value = null = "Todos".
 *
 * Se arma la URL solo a partir de la ruta actual y preserva los demás params
 * (ej. el filtro `f`). NO recibe funciones como prop: así puede usarse desde
 * Server Components — pasar una función a un Client Component rompe la
 * serialización ("Functions cannot be passed directly to Client Components").
 */
export function MonthPicker({ value }: { value: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  function onChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const v = e.target.value === "__all__" ? null : e.target.value;
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (v) params.set("m", v);
    else params.delete("m");
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return (
    <div className="flex items-center gap-1.5">
      <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
      <select
        value={value ?? "__all__"}
        onChange={onChange}
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
