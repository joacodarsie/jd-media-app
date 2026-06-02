import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * El calendario por cliente ahora vive dentro del calendario global con el
 * filtro de ese cliente aplicado. Esta ruta se mantiene como redirección para
 * no romper links viejos, bookmarks ni los revalidatePath existentes.
 */
export default function ClientCalendarRedirect({
  params,
}: {
  params: { id: string };
}) {
  redirect(`/contenidos?cliente=${params.id}`);
}
