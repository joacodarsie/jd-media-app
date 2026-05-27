/**
 * Constantes compartidas de templates.
 * Vive aca (sin "use server") asi se pueden importar desde server actions Y
 * desde componentes client. Si los exportabamos desde actions.ts, Next las
 * convertia en server references y .map fallaba en el cliente.
 */

export const TEMPLATE_CATEGORIES = [
  "chat",
  "comercial",
  "onboarding",
  "copy",
  "otro",
] as const;

export type TemplateCategory = (typeof TEMPLATE_CATEGORIES)[number];

export const TEMPLATE_CATEGORY_LABEL: Record<TemplateCategory, string> = {
  chat: "Chat interno",
  comercial: "Comercial / Leads",
  onboarding: "Onboarding cliente",
  copy: "Copy / Redes",
  otro: "Otro",
};
