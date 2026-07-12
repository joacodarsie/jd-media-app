"use client";

// Header de tabla ordenable (flecha asc/desc). Vivía copiado idéntico en las
// tablas de gastos, cobros y pagos; ahora es uno solo.

import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export function SortTh({
  children,
  onClick,
  active,
  dir,
  align = "left",
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  dir: "asc" | "desc";
  align?: "left" | "right";
}) {
  return (
    <th className={cn("px-3 py-2", align === "right" && "text-right")}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 hover:text-foreground",
          active && "text-foreground"
        )}
      >
        {children}
        <ArrowUpDown
          className={cn(
            "h-3 w-3 opacity-50",
            active && "opacity-100",
            active && dir === "desc" && "rotate-180"
          )}
        />
      </button>
    </th>
  );
}
