"use client";

import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const HERRAMIENTAS = [
  { href: "/contenidos/salio", label: "✅ ¿Salió de verdad?" },
  { href: "/contenidos/publicado", label: "📸 Lo que salió" },
  { href: "/contenidos/inspo", label: "💡 Inspo" },
  { href: "/contenidos/guiones", label: "📝 Guiones del mes" },
];

/** Las herramientas de Contenidos: un menú en vez de cuatro botones sobre el calendario. */
export function ContenidosHerramientas() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          Herramientas <ChevronDown className="h-3.5 w-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {HERRAMIENTAS.map((h) => (
          <DropdownMenuItem key={h.href} asChild className="cursor-pointer">
            <Link href={h.href}>{h.label}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
