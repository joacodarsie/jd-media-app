import { redirect } from "next/navigation";

/** Las jornadas se mudaron a /jornadas (23/10/2026), donde también entra Luz. */
export default function JornadasViejas() {
  redirect("/jornadas");
}
