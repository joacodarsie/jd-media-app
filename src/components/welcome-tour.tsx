"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getTourSteps, TOUR_STORAGE_KEY } from "@/lib/tour/steps";

/**
 * Tour de bienvenida. Se monta una vez en el layout autenticado.
 *
 * - Si el user nunca lo completó: se abre solo despues de 1.5s del primer load.
 * - Si ya lo completó: se queda dormido. Se puede reabrir con el event
 *   `jd:start-tour` (despachado desde el boton 'Hacer tour' en Mi perfil).
 *
 * El estado "completado" vive en localStorage para no requerir migration.
 * Si quisieramos persistir por user, conviene mover a `users.tour_completed_at`.
 */
export function WelcomeTour({
  userRol,
  userName,
}: {
  userRol: string;
  userName: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [idx, setIdx] = useState(0);
  const steps = getTourSteps(userRol);
  const step = steps[idx];

  const close = useCallback(() => {
    setOpen(false);
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, new Date().toISOString());
    } catch {}
  }, []);

  // Auto-open la primera vez, pero SOLO si el user esta en el dashboard o root.
  // Asi evitamos yankearlo desde una URL deep-linkeada (ej: una pub o tarea
  // especifica que abrio desde una notificacion).
  useEffect(() => {
    const isHome = pathname === "/dashboard" || pathname === "/";
    if (!isHome) return;
    try {
      const seen = localStorage.getItem(TOUR_STORAGE_KEY);
      if (!seen) {
        const t = setTimeout(() => setOpen(true), 1500);
        return () => clearTimeout(t);
      }
    } catch {}
  }, [pathname]);

  // Permitir reabrirlo desde "Hacer el tour de nuevo"
  useEffect(() => {
    function onStart() {
      setIdx(0);
      setOpen(true);
    }
    window.addEventListener("jd:start-tour", onStart);
    return () => window.removeEventListener("jd:start-tour", onStart);
  }, []);

  // Navegar a la ruta del step actual
  useEffect(() => {
    if (!open) return;
    if (!step?.route) return;
    router.push(step.route);
  }, [open, idx, step?.route, router]);

  if (!open || !step) return null;

  const isFirst = idx === 0;
  const isLast = idx === steps.length - 1;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[80] bg-black/40 backdrop-blur-sm"
        onClick={close}
        aria-hidden
      />

      {/* Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={step.title}
        className="fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-card shadow-2xl"
      >
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Tour · paso {idx + 1} de {steps.length}
          </div>
          <button
            type="button"
            onClick={close}
            className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label="Cerrar tour"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-5">
          <h2 className="text-xl font-bold tracking-tight">
            {isFirst ? `${step.title.replace(/!$/, "")}, ${userName.split(" ")[0]}!` : step.title}
          </h2>
          <p className="text-[14.5px] leading-relaxed text-foreground/85">
            {step.body}
          </p>
          {step.ctaHref && step.ctaLabel && (
            <Link
              href={step.ctaHref}
              onClick={close}
              className="inline-flex items-center gap-1 rounded-md bg-primary/15 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25"
            >
              {step.ctaLabel}
            </Link>
          )}
        </div>

        <div className="flex flex-col gap-3 border-t bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:px-5">
          <div className="flex flex-wrap items-center gap-1">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-4 rounded-full transition sm:w-5 ${
                  i === idx
                    ? "bg-primary"
                    : i < idx
                    ? "bg-primary/40"
                    : "bg-muted-foreground/20"
                }`}
              />
            ))}
          </div>
          <div className="flex w-full items-center justify-end gap-2 sm:w-auto">
            {!isFirst && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIdx((i) => Math.max(0, i - 1))}
              >
                <ArrowLeft className="mr-1 h-3.5 w-3.5" />
                Atrás
              </Button>
            )}
            {isLast ? (
              <Button size="sm" onClick={close}>
                Empezar
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setIdx((i) => Math.min(steps.length - 1, i + 1))}
              >
                Siguiente
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
