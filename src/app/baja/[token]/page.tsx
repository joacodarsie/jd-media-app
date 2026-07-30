import { createAdmin } from "@/lib/supabase/admin";
import { emailDeToken } from "@/lib/prospecting/cold-email-token";
import { bajaSecret } from "@/lib/email/cold-sender";

export const dynamic = "force-dynamic";

/**
 * Baja de un clic de los emails en frío. Pública (va en PUBLIC_PATHS).
 *
 * Se da de baja apenas se abre el link, sin pedir confirmación: si alguien
 * llegó hasta acá no quiere que le escribamos más, y hacerle hacer un paso más
 * es la clase de fricción por la que la gente reporta spam en vez de darse de
 * baja. El token viene firmado, así que nadie puede dar de baja a un tercero.
 */
export default async function BajaPage({ params }: { params: { token: string } }) {
  const email = emailDeToken(params.token, bajaSecret());

  let ok = false;
  if (email) {
    const admin = createAdmin();
    const { error } = await admin
      .from("cold_email_optouts")
      .upsert({ email, motivo: "baja por link" }, { onConflict: "email" });
    ok = !error;
    if (ok) {
      // Que no le vuelva a entrar por la cola ya armada.
      await admin
        .from("cold_email_sends")
        .update({ estado: "error", error: "Se dio de baja" })
        .eq("email", email)
        .eq("estado", "pendiente");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-6 py-16">
      <div className="rounded-xl border bg-card p-8 text-center shadow-sm">
        {ok ? (
          <>
            <p className="text-4xl">✅</p>
            <h1 className="mt-4 text-xl font-semibold">Listo, te damos de baja</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              No vas a recibir más mensajes nuestros en{" "}
              <span className="font-medium text-foreground">{email}</span>.
            </p>
            <p className="mt-4 text-xs text-muted-foreground">
              Perdón por la molestia. Si fue un error, respondenos el último mail y
              te volvemos a dar de alta.
            </p>
          </>
        ) : (
          <>
            <p className="text-4xl">🤔</p>
            <h1 className="mt-4 text-xl font-semibold">Este link no es válido</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Puede estar cortado por el correo. Respondé el mail con la palabra
              <b> baja</b> y te sacamos de la lista a mano.
            </p>
          </>
        )}
        <p className="mt-6 border-t pt-4 text-xs text-muted-foreground">JD Media</p>
      </div>
    </main>
  );
}
