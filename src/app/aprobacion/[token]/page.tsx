import { notFound } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { ApprovalPortal } from "./portal";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface PublicPub {
  id: string;
  titulo: string;
  descripcion: string | null;
  copy: string | null;
  guion: string | null;
  red: string;
  tipo: string;
  fecha_publicacion: string | null;
  hashtags: string | null;
  asset_url: string | null;
  referencia_url: string | null;
  estado: string;
  notas_revision: string | null;
  cliente_revision_iniciada_at: string | null;
  publicacion_url: string | null;
  resubido_tiktok: boolean;
}

interface PublicComment {
  id: string;
  publication_id: string;
  contenido: string;
  created_at: string;
}

export default async function AprobacionPage({
  params,
}: {
  params: { token: string };
}) {
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data, error } = await sb.rpc("jd_get_approval_payload", {
    p_token: params.token,
  });

  if (error || !data || !(data as { ok: boolean }).ok) {
    notFound();
  }

  const payload = data as {
    ok: boolean;
    cliente: { id: string; nombre: string };
    publicaciones: PublicPub[];
    comentarios: PublicComment[];
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b bg-white dark:bg-zinc-900">
        <div className="mx-auto max-w-5xl px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-black font-black text-[#FFD400]">
              JD
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">
                Portal de contenidos
              </div>
              <h1 className="text-xl font-bold">{payload.cliente.nombre}</h1>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6">
        <ApprovalPortal
          token={params.token}
          publicaciones={payload.publicaciones}
          comentarios={payload.comentarios ?? []}
        />
      </main>
      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        JD Media · jdmedia.com.ar
      </footer>
    </div>
  );
}
