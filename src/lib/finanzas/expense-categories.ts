/**
 * Categorías de gastos. Módulo SERVER-SAFE (sin "use client") para que tanto las
 * páginas server (ej: /finanzas/gastos) como los diálogos de cliente puedan
 * importarlo. Antes vivía en `expense-form-dialog` ("use client"): al usarlo un
 * server component, `EXPENSE_CATEGORIES.find(...)` reventaba el render
 * ("Attempted to call find() from the server but find is on the client").
 */
import type { ExpenseCategory } from "@/app/(app)/finanzas/actions";

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "plataformas", label: "Plataformas (Notion, Adobe, Canva…)" },
  { value: "ads", label: "Ads de JD Media propios" },
  { value: "servicios", label: "Servicios pro (contador, abogado)" },
  { value: "impuestos", label: "Impuestos / monotributo" },
  { value: "bancos", label: "Bancos / comisiones" },
  { value: "oficina", label: "Oficina (alquiler, luz, internet)" },
  { value: "equipamiento", label: "Equipamiento" },
  { value: "otros", label: "Otros" },
];

/** Etiqueta legible de una categoría de gasto (o el propio valor si no matchea). */
export const expenseCategoryLabel = (cat: string): string =>
  EXPENSE_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
