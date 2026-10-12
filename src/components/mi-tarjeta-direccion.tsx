import { createAdmin } from "@/lib/supabase/admin";
import { hoyYmd } from "@/lib/dates";
import { cargarTablero, type Tablero } from "@/lib/direccion/coordinadores-run";
import { TarjetaCoordinador } from "@/components/tarjeta-coordinador";

/**
 * En Mi día de cada coordinador: su tarjeta, la misma que ve la dirección.
 * Pedido del dueño (12/10/2026): que sepan cómo los está siguiendo. Quien no
 * es coordinador no ve nada.
 */
export async function MiTarjetaDireccion({ userId }: { userId: string }) {
  const { tarjetas, pedidos } = await cargarTablero(createAdmin(), hoyYmd(), userId).catch(
    (): Tablero => ({ tarjetas: [], pedidos: {} })
  );
  const t = tarjetas[0];
  if (!t) return null;
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Cómo te ve la dirección
      </p>
      <TarjetaCoordinador t={t} pedidos={pedidos[userId] ?? []} puedePedir={false} />
    </div>
  );
}
