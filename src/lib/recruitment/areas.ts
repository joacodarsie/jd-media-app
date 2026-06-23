/**
 * Áreas de reclutamiento. Vive en un módulo SERVER-SAFE (sin "use client") para
 * que tanto los server components (páginas) como el form de cliente puedan
 * importarlo. Antes estaba en el componente `recruitment-search-form` ("use
 * client"): al importarlo un server component, Next lo convertía en una
 * referencia de cliente y `AREA_OPTIONS.find(...)` reventaba el render
 * ("Attempted to call find() from the server but find is on the client").
 */
export const AREA_OPTIONS = [
  { value: "cm", label: "Community Manager" },
  { value: "diseno", label: "Diseño" },
  { value: "edicion", label: "Edición audiovisual" },
  { value: "pauta", label: "Pauta / Paid Media" },
  { value: "desarrollo", label: "Desarrollo web" },
  { value: "comercial", label: "Comercial / Ventas" },
  { value: "otro", label: "Otro" },
] as const;

/** Etiqueta legible de un área (o el propio valor / "—" si no matchea). */
export const areaLabel = (a: string | null): string =>
  AREA_OPTIONS.find((o) => o.value === a)?.label ?? a ?? "—";
