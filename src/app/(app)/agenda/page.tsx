import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdmin } from "@/lib/supabase/admin";
import { listEventsForUser } from "@/lib/google-calendar";
import { AgendaView } from "@/components/agenda-view";
import { HelpTrigger } from "@/components/help-trigger";

export const dynamic = "force-dynamic";

export default async function AgendaPage() {
  const me = await requireUser();
  const supabase = createClient();

  const admin = createAdmin();
  const [{ data: conns }, { data: clientsRaw }] = await Promise.all([
    admin
      .from("google_calendar_connections")
      .select("id, label, google_email, visibility, owner_user_id")
      .or(`owner_user_id.eq.${me.id},visibility.eq.shared`)
      .order("created_at", { ascending: true }),
    supabase
      .from("clients")
      .select("id, nombre, contacto_email")
      .order("nombre"),
  ]);

  const connections = (conns ?? []).map((c) => ({
    id: c.id,
    label: c.label,
    google_email: c.google_email,
    visibility: c.visibility,
    mine: c.owner_user_id === me.id,
  }));

  const clients = (clientsRaw ?? []).map((c) => ({
    id: c.id as string,
    nombre: c.nombre as string,
    contacto_email: (c.contacto_email as string | null) ?? null,
  }));

  // Initial fetch SSR: grilla del mes actual (≈42 días) — cubre Mes default + Lista + Semana.
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  // startOfWeek (lunes) del primer día del mes
  const dayOfWeek = monthStart.getDay();
  const monStartDiff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const from = new Date(monthStart);
  from.setDate(from.getDate() + monStartDiff);
  from.setHours(0, 0, 0, 0);
  const to = new Date(from);
  to.setDate(to.getDate() + 42);
  to.setHours(23, 59, 59, 999);

  let initialEvents: Awaited<ReturnType<typeof listEventsForUser>> = [];
  if (connections.length > 0) {
    try {
      initialEvents = await listEventsForUser(me.id, from.toISOString(), to.toISOString());
    } catch {
      initialEvents = [];
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          Agenda
          <HelpTrigger slug="agenda" label="Cómo usar Agenda" size="md" />
        </h1>
        <p className="text-muted-foreground">
          Tus reuniones de Google Calendar — personales y de JD Media.
        </p>
      </div>

      <AgendaView
        connections={connections}
        clients={clients}
        initialEvents={initialEvents}
        initialFrom={from.toISOString()}
        initialTo={to.toISOString()}
      />
    </div>
  );
}
