import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { JdmediaLive } from "@/components/jdmedia-live";

export const dynamic = "force-dynamic";

export default async function JdmediaLivePage() {
  const me = await requireUser();
  const owner = process.env.JDMEDIA_LIVE_OWNER_EMAIL;
  // Gate estricto: sólo la cuenta dueña configurada en env.
  if (!owner || me.email !== owner) redirect("/jdmedia");

  return (
    <div className="-m-4 h-[calc(100vh-3.5rem)] md:-m-6">
      <JdmediaLive userName={me.nombre} />
    </div>
  );
}
