import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { requireRole } from "@/lib/auth";
import { PostMeetWorkspace } from "@/components/post-meet-workspace";
import { HelpTrigger } from "@/components/help-trigger";

export const dynamic = "force-dynamic";

export default async function PostMeetPage() {
  await requireRole(["admin", "coordinador", "comercial", "prospecting"]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/comercial"
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" /> Pipeline comercial
        </Link>
      </div>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <Sparkles className="h-6 w-6 text-primary" />
          Mensaje post-meet
          <HelpTrigger slug="comercial" label="Cómo usarlo" size="md" />
        </h1>
        <p className="text-muted-foreground">
          Pegá la transcripción de la primera reunión (o un resumen con los
          puntos clave) y JDmedIA te devuelve el mensaje de follow-up listo
          para mandarle al cliente.
        </p>
      </div>

      <PostMeetWorkspace />
    </div>
  );
}
