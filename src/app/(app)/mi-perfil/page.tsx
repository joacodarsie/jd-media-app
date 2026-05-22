import Link from "next/link";
import { Briefcase } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Compensation, Position } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompensationCard } from "@/components/compensation-card";
import { WhatsAppOptinCard } from "@/components/whatsapp-optin-card";

export const dynamic = "force-dynamic";

export default async function MiPerfilPage() {
  const me = await requireUser();
  const supabase = createClient();

  const [{ data: position }, { data: comp }] = await Promise.all([
    me.position_id
      ? supabase.from("positions").select("*").eq("id", me.position_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("compensation").select("*").eq("user_id", me.id).maybeSingle(),
  ]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Mi perfil</h1>
        <p className="text-muted-foreground">Tu puesto, tu pago y tus datos.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Datos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 text-sm">
          <div>
            <strong>{me.nombre}</strong>
          </div>
          <div className="text-muted-foreground">{me.email}</div>
          <div className="text-muted-foreground">{me.area}</div>
        </CardContent>
      </Card>

      {position && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Briefcase className="h-4 w-4" /> Puesto
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm">
            <Link
              href={`/equipo/${position.id}`}
              className="font-semibold hover:underline"
            >
              {(position as Position).nombre}
            </Link>
            {(position as Position).descripcion && (
              <p className="mt-1 text-muted-foreground">
                {(position as Position).descripcion}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <CompensationCard
        compensation={(comp as Compensation) ?? null}
        position={(position as Position) ?? null}
      />

      <WhatsAppOptinCard
        initialPhone={
          (me as unknown as { whatsapp_phone?: string | null }).whatsapp_phone ?? null
        }
        initialOptin={
          (me as unknown as { whatsapp_optin?: boolean }).whatsapp_optin ?? false
        }
      />
    </div>
  );
}
