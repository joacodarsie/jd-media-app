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
