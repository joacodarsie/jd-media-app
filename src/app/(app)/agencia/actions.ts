"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function ctx() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("No autenticado");
  return { supabase, userId: user.id };
}

export interface AgencyPageInput {
  slug: string;
  title: string;
  kind: string;
  orden: number;
  content: string;
  notion_url: string | null;
}

function clean(input: AgencyPageInput) {
  return {
    slug: input.slug.trim().toLowerCase().replace(/\s+/g, "-"),
    title: input.title.trim(),
    kind: input.kind,
    orden: input.orden ?? 0,
    content: input.content,
    notion_url: input.notion_url?.trim() || null,
  };
}

export async function upsertAgencyPage(input: AgencyPageInput, originalSlug?: string) {
  const { supabase } = await ctx();
  const payload = clean(input);
  let error;
  if (originalSlug && originalSlug !== payload.slug) {
    ({ error } = await supabase
      .from("agency_pages")
      .update(payload)
      .eq("slug", originalSlug));
  } else {
    ({ error } = await supabase
      .from("agency_pages")
      .upsert(payload, { onConflict: "slug" }));
  }
  if (error) return { error: error.message };
  revalidatePath("/agencia");
  revalidatePath("/procesos");
  revalidatePath(`/agencia/${payload.slug}`);
  revalidatePath(`/procesos/${payload.slug}`);
  return { ok: true, slug: payload.slug };
}

export async function deleteAgencyPage(slug: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("agency_pages").delete().eq("slug", slug);
  if (error) return { error: error.message };
  revalidatePath("/agencia");
  revalidatePath("/procesos");
  return { ok: true };
}

// ---------- Quick Links ----------

export interface QuickLinkInput {
  id?: string;
  label: string;
  url: string;
  icon: string | null;
  orden: number;
}

function cleanQuickLink(input: QuickLinkInput) {
  return {
    label: input.label.trim(),
    url: input.url.trim(),
    icon: input.icon?.trim() || null,
    orden: Number.isFinite(input.orden) ? input.orden : 0,
  };
}

export async function upsertQuickLink(input: QuickLinkInput) {
  const { supabase } = await ctx();
  const payload = cleanQuickLink(input);
  if (!payload.label || !payload.url) {
    return { error: "Faltan label o URL." };
  }
  if (input.id) {
    const { error } = await supabase
      .from("quick_links")
      .update(payload)
      .eq("id", input.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("quick_links").insert(payload);
    if (error) return { error: error.message };
  }
  revalidatePath("/agencia");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deleteQuickLink(id: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("quick_links").delete().eq("id", id);
  if (error) return { error: error.message };
  revalidatePath("/agencia");
  revalidatePath("/", "layout");
  return { ok: true };
}

// ---------- Services (catálogo) ----------

export interface ServiceInput {
  slug: string;
  originalSlug?: string;
  name: string;
  description: string | null;
  color: string | null;
  icon: string | null;
  areas: string[];
  orden: number;
  active: boolean;
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/(^_|_$)/g, "");
}

export async function upsertService(input: ServiceInput) {
  const { supabase } = await ctx();
  const slug = input.slug ? slugify(input.slug) : slugify(input.name);
  if (!slug) return { error: "Falta nombre del servicio." };
  const payload = {
    slug,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    color: input.color?.trim() || null,
    icon: input.icon?.trim() || null,
    areas: (input.areas ?? []).map((a) => a.trim()).filter(Boolean),
    orden: Number.isFinite(input.orden) ? input.orden : 0,
    active: input.active,
  };
  if (!payload.name) return { error: "Falta nombre." };

  if (input.originalSlug && input.originalSlug !== slug) {
    const { error } = await supabase
      .from("services")
      .update(payload)
      .eq("slug", input.originalSlug);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase
      .from("services")
      .upsert(payload, { onConflict: "slug" });
    if (error) return { error: error.message };
  }
  revalidatePath("/agencia");
  return { ok: true, slug };
}

export async function deleteService(slug: string) {
  const { supabase } = await ctx();
  const { error } = await supabase.from("services").delete().eq("slug", slug);
  if (error) return { error: error.message };
  revalidatePath("/agencia");
  return { ok: true };
}
