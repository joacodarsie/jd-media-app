"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  ListChecks,
  Calendar,
  Users,
  Users2,
  UserCircle,
  Briefcase,
  BarChart3,
  FileText,
  FolderOpen,
  Sparkles,
  Wallet,
  KeyRound,
  Menu,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { visibleNav } from "@/lib/nav";
import { ROLE_LABEL } from "@/lib/constants";
import type { AppUser } from "@/lib/types";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { GlobalSearch } from "@/components/global-search";
import { QuickLinksMenu } from "@/components/quick-links-menu";
import type { QuickLinkRow } from "@/components/quick-links-manager";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const ICONS: Record<string, LucideIcon> = {
  Sun,
  ListChecks,
  Calendar,
  Users,
  Users2,
  UserCircle,
  Briefcase,
  BarChart3,
  FileText,
  FolderOpen,
  Sparkles,
  Wallet,
  KeyRound,
};

function initials(nombre: string) {
  return nombre
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function SidebarContent({
  user,
  onNavigate,
}: {
  user: AppUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const items = visibleNav(user);
  return (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFD400]">
          <span className="text-sm font-extrabold text-black">JD</span>
        </div>
        <span className="text-lg font-bold">JD Media</span>
      </div>
      <nav className="flex-1 space-y-1 px-3">
        {items.map((item) => {
          const Icon = ICONS[item.icon] ?? ListChecks;
          const active =
            pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                active
                  ? "bg-[#FFD400] text-black"
                  : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-sidebar-border px-5 py-4 text-xs text-sidebar-foreground/60">
        {ROLE_LABEL[user.rol]} · {user.area}
      </div>
    </div>
  );
}

export function AppShell({
  user,
  bell,
  quickLinks,
  children,
}: {
  user: AppUser;
  bell?: React.ReactNode;
  quickLinks?: QuickLinkRow[];
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 md:block">
        <div className="fixed h-screen w-60">
          <SidebarContent user={user} />
        </div>
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <SidebarContent user={user} onNavigate={() => setOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Abrir menú"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          <GlobalSearch />
          <div className="flex-1" />
          {quickLinks && quickLinks.length > 0 && (
            <QuickLinksMenu links={quickLinks} />
          )}
          {bell}
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full pl-1 outline-none">
                <Avatar className="h-8 w-8">
                  {user.avatar_url && (
                    <AvatarImage src={user.avatar_url} alt={user.nombre} />
                  )}
                  <AvatarFallback className="bg-[#FFD400] text-xs font-bold text-black">
                    {initials(user.nombre)}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>
                <div className="font-medium">{user.nombre}</div>
                <div className="text-xs font-normal text-muted-foreground">
                  {user.email}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <form action="/auth/signout" method="post">
                <button type="submit" className="w-full">
                  <DropdownMenuItem className="cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Cerrar sesión
                  </DropdownMenuItem>
                </button>
              </form>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
