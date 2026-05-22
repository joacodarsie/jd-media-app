"use client";

import { ExternalLink, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { iconFor } from "@/lib/quick-link-icons";
import type { QuickLinkRow } from "@/components/quick-links-manager";

export function QuickLinksMenu({ links }: { links: QuickLinkRow[] }) {
  if (!links.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Accesos rápidos"
          title="Accesos rápidos"
        >
          <Sparkles className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Accesos rápidos</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {links.map((l) => {
          const Icon = iconFor(l.icon);
          return (
            <DropdownMenuItem key={l.id} asChild>
              <a
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex cursor-pointer items-center gap-2"
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1 truncate">{l.label}</span>
                <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
              </a>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
