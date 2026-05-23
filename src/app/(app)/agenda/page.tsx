import { requireUser } from "@/lib/auth";
import { createAdmin } from "@/lib/supabase/admin";
import { AgendaView } from "@/components/agenda-view";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const me = await requireUser();

  const admin = createAdmin();
  const { data: conns } = await admin
    .from("google_calendar_connections")
    .select("id, label, google_email, visibility, owner_user_id")
    .or(`owner_user_id.eq.${me.id},visibility.eq.shared`)
    .order("created_at", { ascending: true });

  const connections = (conns ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    google_email: c.google_email,
    visibility: c.visibility,
    mine: c.owner_user_id === me.id,
  }));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">Agenda</h1>
        <p className="text-muted-foreground">
          Tus reuniones de Google Calendar — personales y de JD Media.
        </p>
      </div>

      <AgendaView connections={connections} />
    </div>
  );
}
