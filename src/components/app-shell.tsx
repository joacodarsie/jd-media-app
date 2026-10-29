"use client";

import { hoyYmd } from "@/lib/dates";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sun,
  ListChecks,
  Calendar,
  CalendarClock,
  Users,
  Users2,
  UserCircle,
  UserSearch,
  Briefcase,
  BarChart3,
  FileText,
  FolderOpen,
  Hash,
  MessageCircle,
  Sparkles,
  Target,
  Wallet,
  HandCoins,
  KeyRound,
  Gauge,
  BookOpen,
  Megaphone,
  Radio,
  Radar,
  SlidersHorizontal,
  Banknote,
  Network,
  Clapperboard,
  UsersRound,
  MessageSquareWarning,
  Rocket,
  TrendingUp,
  Goal,
  Compass,
  Menu,
  LogOut,
  UserRound,
  ChevronDown,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { EfectosGlobales } from "@/components/efectos-globales";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { visibleNavGroups, visibleNav, matchNavItem } from "@/lib/nav";
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
  CalendarClock,
  Users,
  Users2,
  UserCircle,
  UserSearch,
  Briefcase,
  BarChart3,
  FileText,
  FolderOpen,
  Hash,
  MessageCircle,
  Sparkles,
  Target,
  Wallet,
  HandCoins,
  KeyRound,
  Gauge,
  BookOpen,
  Megaphone,
  Radio,
  Radar,
  SlidersHorizontal,
  Banknote,
  Network,
  MessageSquareWarning,
  Rocket,
  Clapperboard,
  UsersRound,
  TrendingUp,
  Goal,
  Compass,
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
  badges = {},
  novedadesLatestDate,
  isLiveOwner = false,
  onNavigate,
}: {
  user: AppUser;
  badges?: Record<string, number>;
  novedadesLatestDate?: string | null;
  isLiveOwner?: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const groups = visibleNavGroups(user, isLiveOwner);

  // Sólo UN item activo: el del match más largo (incluye rutas `match`, o sea
  // las sub-páginas/pestañas de la sección). Así "Equipo" queda marcado también
  // cuando estás en /reclutamiento u /organigrama, y no te perdés. Se calcula
  // sobre los items VISIBLES para que una pestaña de una sección oculta no robe
  // el resaltado.
  const activeItem = matchNavItem(
    pathname,
    groups.flatMap((g) => g.items)
  );
  const activeHref = activeItem?.href ?? "";

  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const prevPathname = useRef(pathname);
  useEffect(() => {
    if (prevPathname.current !== pathname) {
      prevPathname.current = pathname;
      setPendingHref(null);
    }
  }, [pathname]);

  // Sobreescribe el badge de novedades si el usuario ya las vio.
  // El marker en /novedades guarda la ultima fecha vista en localStorage; aca
  // comparamos para apagar el badge hasta que aparezca una entry nueva.
  const [novedadesSeen, setNovedadesSeen] = useState<string | null>(null);
  useEffect(() => {
    function read() {
      try {
        setNovedadesSeen(localStorage.getItem("jd:novedades-last-seen"));
      } catch {}
    }
    read();
    window.addEventListener("jd:novedades-seen", read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener("jd:novedades-seen", read);
      window.removeEventListener("storage", read);
    };
  }, []);
  const novedadesAlreadySeen =
    novedadesLatestDate && novedadesSeen && novedadesSeen >= novedadesLatestDate;

  // Grupos colapsables: las secciones con label arrancan plegadas (para no
  // abrumar) y se recuerda la preferencia. El grupo que contiene la ruta activa
  // se abre solo.
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      const raw = localStorage.getItem("jd:nav:collapsed");
      if (raw) setCollapsed(JSON.parse(raw));
    } catch {}
  }, []);
  function toggleGroup(label: string) {
    setCollapsed((prev) => {
      const next = { ...prev, [label]: !(prev[label] ?? true) };
      try {
        localStorage.setItem("jd:nav:collapsed", JSON.stringify(next));
      } catch {}
      return next;
    });
  }
  return (
    <div className="jd-sidebar flex h-full max-h-[100dvh] min-h-0 flex-col bg-sidebar text-sidebar-foreground">
      <div className="group/logo flex items-center gap-2 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#FFD400] shadow-[0_0_24px_rgba(255,212,0,.35)] transition-transform duration-500 group-hover/logo:-rotate-6 group-hover/logo:scale-110">
          <span className="text-sm font-extrabold text-black">JD</span>
        </div>
        <span className="text-lg font-bold">JD Media</span>
      </div>
      <nav className="sidebar-scroll min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-3 pb-4">
        {groups.map((group, gi) => {
          const groupHasActive = group.items.some((i) => i.href === activeHref);
          const isCollapsed = group.label
            ? groupHasActive
              ? false
              : (collapsed[group.label] ?? true)
            : false;
          const groupBadge = group.items.reduce((sum, i) => {
            const raw = badges[i.href] ?? 0;
            const b = i.href === "/portal" && novedadesAlreadySeen ? 0 : raw;
            return sum + b;
          }, 0);
          return (
          <div key={group.label ?? `g-${gi}`} className="space-y-0.5">
            {group.label && (
              <button
                type="button"
                onClick={() => toggleGroup(group.label!)}
                className={cn(
                  "flex w-full items-center gap-1 px-3 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider transition-colors",
                  groupHasActive
                    ? "text-sidebar-foreground/90"
                    : "text-sidebar-foreground/50 hover:text-sidebar-foreground/80"
                )}
              >
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    isCollapsed && "-rotate-90"
                  )}
                />
                <span className="flex-1 text-left">{group.label}</span>
                {isCollapsed && groupBadge > 0 && (
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" aria-label="Novedades en esta sección" />
                )}
              </button>
            )}
            {!isCollapsed && group.items.map((item) => {
              const Icon = ICONS[item.icon] ?? ListChecks;
              const active = item.href === activeHref;
              const isPending = pendingHref === item.href && !active;
              const rawBadge = badges[item.href] ?? 0;
              const badge =
                item.href === "/portal" && novedadesAlreadySeen ? 0 : rawBadge;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    if (!active) setPendingHref(item.href);
                    onNavigate?.();
                  }}
                  className={cn(
                    "jd-nav group/nav flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all duration-200",
                    active
                      ? "jd-nav-activo bg-[#FFD400] text-black"
                      : isPending
                      ? "bg-sidebar-accent/70 text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  {isPending ? (
                    <span className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-sidebar-foreground/30 border-t-sidebar-foreground/80" />
                  ) : (
                    <Icon className="h-[18px] w-[18px] transition-transform duration-300 group-hover/nav:scale-110 group-hover/nav:-rotate-6" />
                  )}
                  <span className="flex-1 truncate transition-transform duration-200 group-hover/nav:translate-x-0.5">{item.label}</span>
                  {badge > 0 && (
                    <span
                      className={cn(
                        "inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums",
                        active
                          ? "bg-black text-[#FFD400]"
                          : "bg-red-500 text-white"
                      )}
                      aria-label={`${badge} ${badge === 1 ? "novedad" : "novedades"}`}
                    >
                      {badge > 99 ? "99+" : badge}
                    </span>
                  )}
                  {badge === 0 && item.nuevoHasta && hoyYmd() <= item.nuevoHasta && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider",
                        active ? "bg-black text-[#FFD400]" : "bg-[#FFD400] text-black"
                      )}
                    >
                      Nuevo
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-sidebar-border px-5 py-3 text-xs text-sidebar-foreground/60">
        <div className="truncate font-medium text-sidebar-foreground/80">
          {user.nombre}
        </div>
        <div className="truncate">
          {ROLE_LABEL[user.rol]} · {user.area}
        </div>
      </div>
    </div>
  );
}

/** Etiqueta de la sección actual según el pathname, para orientar al usuario. */
/**
 * La barra de abajo en el celular (18/10/2026), como una app: las 4 secciones
 * que más se usan (según lo que cada uno puede ver) y «Más», que abre el menú.
 * El ícono activo salta y se marca en amarillo.
 */
// Orden por uso real (29/10/2026): Clientes es lo más abierto; el chat tuvo 6
// visitas en 14 días y queda en «Más».
const PREFERIDAS = ["/dashboard", "/tareas", "/clientes", "/contenidos", "/agenda", "/chat"];
function BarraCelular({
  user,
  isLiveOwner,
  badges,
  onMas,
}: {
  user: AppUser;
  isLiveOwner?: boolean;
  badges: Record<string, number>;
  onMas: () => void;
}) {
  const pathname = usePathname();
  const items = visibleNav(user, isLiveOwner);
  const elegidas = PREFERIDAS.map((h) => items.find((i) => i.href === h)).filter((x): x is (typeof items)[number] => !!x).slice(0, 4);
  const activo = matchNavItem(pathname, items)?.href;
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      aria-label="Secciones principales"
    >
      <div className="grid grid-cols-5">
        {elegidas.map((item) => {
          const Icon = ICONS[item.icon] ?? ListChecks;
          const on = item.href === activo;
          const badge = badges[item.href] ?? 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                on ? "text-foreground" : "text-muted-foreground"
              )}
            >
              <span
                className={cn(
                  "relative flex h-8 w-12 items-center justify-center rounded-full transition-all duration-300",
                  on && "jd-barra-activo bg-[#FFD400] text-black"
                )}
              >
                <Icon className="h-5 w-5" />
                {badge > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {badge > 9 ? "9+" : badge}
                  </span>
                )}
              </span>
              <span className="max-w-full truncate px-1">{item.label}</span>
            </Link>
          );
        })}
        <button type="button" onClick={onMas} className="flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium text-muted-foreground">
          <span className="flex h-8 w-12 items-center justify-center rounded-full">
            <Menu className="h-5 w-5" />
          </span>
          Más
        </button>
      </div>
    </nav>
  );
}

function currentSectionLabel(
  pathname: string,
  user: AppUser,
  isLiveOwner: boolean
): string {
  return matchNavItem(pathname, visibleNav(user, isLiveOwner))?.label ?? "";
}

export function AppShell({
  user,
  bell,
  quickLinks,
  badges,
  novedadesLatestDate,
  isLiveOwner = false,
  children,
}: {
  user: AppUser;
  bell?: React.ReactNode;
  quickLinks?: QuickLinkRow[];
  badges?: Record<string, number>;
  novedadesLatestDate?: string | null;
  isLiveOwner?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const sectionLabel = currentSectionLabel(pathname, user, isLiveOwner);

  // Qué secciones se usan (19/10/2026, 0204): una visita por cambio de página.
  // Sin la migración, la función no existe y falla en silencio.
  useEffect(() => {
    const seccion = sectionLabel || `/${pathname.split("/")[1] ?? ""}`;
    void createBrowserSupabase()
      .rpc("registrar_uso", { p_seccion: seccion })
      .then(() => undefined, () => undefined);
  }, [pathname, sectionLabel]);

  return (
    <div className="flex min-h-screen">
      <aside className="hidden w-60 shrink-0 md:block">
        <div className="fixed h-[100dvh] w-60">
          <SidebarContent
            user={user}
            badges={badges}
            novedadesLatestDate={novedadesLatestDate}
            isLiveOwner={isLiveOwner}
          />
        </div>
      </aside>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="left" className="h-[100dvh] w-64 p-0">
          <SheetTitle className="sr-only">Menú</SheetTitle>
          <SidebarContent
            user={user}
            badges={badges}
            novedadesLatestDate={novedadesLatestDate}
            isLiveOwner={isLiveOwner}
            onNavigate={() => setOpen(false)}
          />
        </SheetContent>
      </Sheet>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl backdrop-saturate-150">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Abrir menú"
            onClick={() => setOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>
          {sectionLabel && (
            <span className="hidden shrink-0 text-sm font-semibold text-foreground/80 md:inline">
              {sectionLabel}
            </span>
          )}
          <GlobalSearch />
          <div className="flex-1" />
          {quickLinks && quickLinks.length > 0 && (
            <QuickLinksMenu links={quickLinks} />
          )}
          {bell}
          <ThemeToggle />
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="relative flex items-center gap-2 rounded-full pl-1 outline-none" aria-label="Mi perfil">
                {!user.avatar_url && (
                  <span
                    className="absolute -right-0.5 -top-0.5 z-10 h-2.5 w-2.5 rounded-full bg-[#FFD400] ring-2 ring-background"
                    title="Te falta subir tu foto en Mi perfil"
                  />
                )}
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
              {/* Antes no había forma de llegar a Mi perfil sin saber la dirección (21/10/2026). */}
              <DropdownMenuItem asChild className="cursor-pointer">
                <Link href="/mi-perfil">
                  <UserRound className="mr-2 h-4 w-4" />
                  Mi perfil y mis datos
                </Link>
              </DropdownMenuItem>
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
        <main className="jd-fondo flex-1 p-4 pb-24 md:p-6">
          <EfectosGlobales />
          {/* Cada pantalla entra con un fundido corto: la navegación se siente viva (18/10/2026). */}
          <div key={pathname} className="jd-pagina">{children}</div>
        </main>
      </div>
      <BarraCelular user={user} isLiveOwner={isLiveOwner} badges={badges ?? {}} onMas={() => setOpen(true)} />
    </div>
  );
}
