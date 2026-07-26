import Link from "next/link";
import { ArrowLeft, AtSign } from "lucide-react";
import { requireUser, isStaffUser, userInRoles } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createAdmin } from "@/lib/supabase/admin";
import {
  listAvailableIgAccounts,
  metaConfigured,
  friendlyIgError,
} from "@/lib/meta/instagram";
import { matchIgAccounts, type IgCuenta } from "@/lib/social/ig-match";
import { IgBulkConnect, type FilaConexion } from "@/components/ig-bulk-connect";

export const dynamic = "force-dynamic";

const CAN_MANAGE = ["admin", "coordinador", "paid_media"];

/**
 * Conectar de una sola vez el Instagram de todas las cuentas activas que
 * todavía no lo tienen. Antes había que entrar cliente por cliente al
 * onboarding: con 15 cuentas sin conectar, el resultado era que nadie lo hacía
 * y el portal mostraba el gráfico de seguidores vacío.
 */
export default async function ConectarInstagramPage() {
  const me = await requireUser();
  if (!isStaffUser(me) && !userInRoles(me, CAN_MANAGE)) redirect("/clientes");

  const admin = createAdmin();
  const { data: clientesRaw } = await admin
    .from("clients")
    .select("id, nombre, ig_user_id, ig_username, instagram_url")
    .eq("estado", "activo")
    .eq("es_interno", false)
    .order("nombre");

  const clientes = (clientesRaw ?? []) as {
    id: string;
    nombre: string;
    ig_user_id: string | null;
    ig_username: string | null;
    instagram_url: string | null;
  }[];
  const sinConectar = clientes.filter((c) => !c.ig_user_id);
  const conectados = clientes.filter((c) => c.ig_user_id);

  let cuentas: IgCuenta[] = [];
  let errorMeta: string | null = null;
  if (!metaConfigured()) {
    errorMeta = "Meta no está configurado en la app (falta META_SYSTEM_USER_TOKEN).";
  } else {
    try {
      cuentas = (await listAvailableIgAccounts()).map((a) => ({
        igUserId: a.igUserId,
        igUsername: a.igUsername,
        pageName: a.pageName,
      }));
    } catch (e) {
      errorMeta = friendlyIgError(e);
    }
  }

  // Las cuentas ya asignadas a otro cliente no se vuelven a ofrecer.
  const yaAsignadas = new Set(clientes.map((c) => c.ig_user_id).filter(Boolean) as string[]);
  const libres = cuentas.filter((c) => !yaAsignadas.has(c.igUserId));

  const sugerencias = matchIgAccounts(
    sinConectar.map((c) => ({ id: c.id, nombre: c.nombre, instagram_url: c.instagram_url })),
    libres
  );
  const porCliente = new Map(sugerencias.map((s) => [s.clienteId, s]));
  const filas: FilaConexion[] = sinConectar.map((c) => ({
    clienteId: c.id,
    nombre: c.nombre,
    instagramUrl: c.instagram_url,
    sugerida: porCliente.get(c.id)?.cuenta ?? null,
    motivo: porCliente.get(c.id)?.motivo ?? null,
  }));

  return (
    <div className="space-y-5">
      <Link
        href="/clientes"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Volver a Clientes
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <AtSign className="h-6 w-6 text-primary" /> Conectar Instagram
        </h1>
        <p className="max-w-3xl text-muted-foreground">
          Vinculá de una sola vez las cuentas que faltan. Con la cuenta conectada,
          los seguidores y el alcance entran solos al <b>portal del cliente</b>, al{" "}
          <b>reporte mensual</b> y al semáforo del <b>Director</b> — que es
          justamente lo que hace que un cliente renueve.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {conectados.length} de {clientes.length} cuentas activas ya están conectadas.
        </p>
      </div>

      {errorMeta ? (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
          No se pudo traer la lista de cuentas de Instagram: {errorMeta}
        </div>
      ) : (
        <>
          {libres.length === 0 && filas.length > 0 && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100">
              El Business Manager no tiene ninguna cuenta de Instagram libre para
              asignar. Para que aparezcan acá, el cliente tiene que compartir su
              página de Facebook con el Business de JD Media y esa página tiene que
              estar asignada al usuario del sistema (el paso a paso está en el
              onboarding de Gestión de Redes de cada cliente).
            </div>
          )}
          <IgBulkConnect filas={filas} cuentas={libres} />
        </>
      )}
    </div>
  );
}
