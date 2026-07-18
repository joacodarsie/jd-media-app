import { redirect } from "next/navigation";

// Novedades ahora vive dentro del Portal (avisos + novedades).
export default function NovedadesRedirect() {
  redirect("/portal?v=novedades");
}
