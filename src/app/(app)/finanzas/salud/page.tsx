import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

// "Salud de la agencia" se sacó: era una tercera vista del margen por cliente
// (basada en piezas publicadas del mes) que se pisaba con el panorama de
// Coordinación (margen estructural) y con Rentabilidad (margen real cobrado).
// Redirige a Rentabilidad para no dejar el link muerto.
export default function SaludRedirect() {
  redirect("/finanzas/rentabilidad");
}
