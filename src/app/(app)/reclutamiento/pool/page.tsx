import { redirect } from "next/navigation";

// El pool ahora ES la home de Reclutamiento. Mantenemos la ruta para no romper
// links/bookmarks viejos.
export default function PoolRedirect() {
  redirect("/reclutamiento");
}
