import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, GraduationCap } from "lucide-react";
import { requireUser, userHas } from "@/lib/auth";
import { MeetingFeedbackWorkspace } from "@/components/meeting-feedback-workspace";

export const dynamic = "force-dynamic";

const COMERCIAL_ROLES = ["admin", "coordinador", "comercial", "prospecting"];

export default async function MeetingFeedbackPage() {
  const me = await requireUser();
  if (!COMERCIAL_ROLES.includes(me.rol) && !userHas(me, "comercial")) {
    redirect("/dashboard");
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <Link
        href="/comercial"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="mr-1 h-4 w-4" /> Pipeline comercial
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <GraduationCap className="h-6 w-6 text-primary" /> Feedback de reunión comercial
        </h1>
        <p className="text-muted-foreground">
          Pegá la transcripción de una reunión con un prospecto y la IA te da un
          feedback de coach de ventas: qué estuvo bien, qué mejorar, qué deberías
          haber dicho o no, para ir afilando cómo das esas reuniones.
        </p>
      </div>

      <MeetingFeedbackWorkspace />
    </div>
  );
}
