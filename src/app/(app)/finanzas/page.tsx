import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * El hub de Finanzas se sacó.
 *
 * Era una pantalla-menú: repetía el número que ya da el Resumen y ofrecía
 * trece links. El dueño dijo tres veces que se mareaba y que no sabía a cuál
 * entrar — el menú ERA el problema, no una solución al problema. Ahora
 * Finanzas son tres destinos con pestañas y este link cae en el primero de
 * "¿por qué?", que es lo que el hub intentaba ser.
 *
 * Lo único que valía la pena de esa pantalla —la tira de lo atrasado— se mudó
 * a "¿Quién me pagó?" (`FinanzasAlertas`).
 */
export default function FinanzasIndexRedirect() {
  redirect("/finanzas/rentabilidad");
}
