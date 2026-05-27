import { notFound } from "next/navigation";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { PrintButton } from "@/components/print-button";

export const dynamic = "force-dynamic";

export default async function ContractPrintPage({
  params,
}: {
  params: { id: string };
}) {
  await requireRole(["admin", "coordinador"]);
  const supabase = createClient();
  const { data: contract } = await supabase
    .from("freelance_contracts")
    .select(
      "id, content_md, persona:users!freelance_contracts_user_id_fkey(id,nombre)"
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!contract) notFound();

  type Row = {
    id: string;
    content_md: string | null;
    persona: { id: string; nombre: string } | null;
  };
  const c = contract as unknown as Row;

  return (
    <div className="min-h-screen bg-white p-6 text-zinc-900 print:p-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 18mm 16mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
        }
        .prose-contract h1 { font-size: 1.4rem; margin-bottom: 0.8rem; }
        .prose-contract h2 { font-size: 1.05rem; margin-top: 1.2rem; margin-bottom: 0.4rem; }
        .prose-contract p { line-height: 1.55; margin: 0.6rem 0; text-align: justify; }
        .prose-contract ul, .prose-contract ol { margin: 0.4rem 0 0.4rem 1.2rem; }
        .prose-contract li { line-height: 1.5; }
      `}</style>
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between">
        <span className="text-sm text-zinc-600">
          Contrato — {c.persona?.nombre ?? "—"}
        </span>
        <PrintButton />
      </div>
      <article className="prose-contract mx-auto max-w-3xl font-serif text-[12.5pt]">
        {c.content_md ? (
          <ReactMarkdown remarkPlugins={[remarkGfm]}>
            {c.content_md}
          </ReactMarkdown>
        ) : (
          <p className="italic text-zinc-500">
            Este contrato aún no tiene contenido. Volvé al editor y generá con IA.
          </p>
        )}
      </article>
    </div>
  );
}
