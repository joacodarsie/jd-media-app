/**
 * Las fotos de los posteos de JD Media para la web, guardadas en nuestro
 * storage (24/10/2026). Las del CDN de Instagram pesan 150-200 KB aunque se
 * muestren de 60 px, y vencen a los pocos días. Se copian una sola vez por
 * posteo y la web las pide achicadas con el render de Supabase.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { imagenChica } from "./imagenes";

const BUCKET = "publish-media";
const CARPETA = "web-ig";

export interface ConFoto {
  id: string;
  imagen: string;
  miniatura?: string;
}

export async function guardarMiniaturas<T extends ConFoto>(admin: SupabaseClient, piezas: T[]): Promise<T[]> {
  const { data: lista } = await admin.storage.from(BUCKET).list(CARPETA, { limit: 1000 });
  const ya = new Set((lista ?? []).map((f) => f.name));
  const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${CARPETA}`;
  const unicas = [...new Map(piezas.map((p) => [p.id, p])).values()];
  await Promise.all(
    unicas
      .filter((p) => !ya.has(`${p.id}.jpg`))
      .map(async (p) => {
        try {
          const r = await fetch(p.imagen);
          if (!r.ok) return;
          const buf = Buffer.from(await r.arrayBuffer());
          const { error } = await admin.storage.from(BUCKET).upload(`${CARPETA}/${p.id}.jpg`, buf, { contentType: "image/jpeg", upsert: true });
          if (!error) ya.add(`${p.id}.jpg`);
        } catch {
          /* queda la del CDN */
        }
      })
  );
  return piezas.map((p) => {
    if (!ya.has(`${p.id}.jpg`)) return p;
    const url = `${base}/${p.id}.jpg`;
    return { ...p, imagen: imagenChica(url, 1080), miniatura: imagenChica(url, 480) };
  });
}
