/**
 * Seguimiento del diagnóstico de la web (19/10/2026): quien pide el
 * diagnóstico de Instagram ya entraba como contacto en Comercial, pero nadie
 * le escribía. Ahora le llega una tarea a comercial con lo que le falta a esa
 * cuenta y el mensaje listo para mandarle por Instagram.
 */
export function tareaSeguimientoDiagnostico(i: {
  usuario: string;
  nombre: string | null;
  puntaje: number;
  mejoras: string[];
}): { titulo: string; descripcion: string } {
  const quien = i.nombre?.trim() || `@${i.usuario}`;
  const primera = i.mejoras[0]?.replace(/\.$/, "") ?? "";
  const mensaje = [
    `¡Hola! Somos JD Media 👋 Vimos que hiciste el diagnóstico de tu Instagram en nuestra web (te dio ${i.puntaje}/100).`,
    primera ? `Lo primero que vemos para mejorar: ${primera.charAt(0).toLowerCase()}${primera.slice(1)}.` : "",
    "Si querés, te mostramos en 15 minutos cómo lo resolveríamos para tu marca, sin compromiso. ¿Te va?",
  ]
    .filter(Boolean)
    .join(" ");
  return {
    titulo: `🔎 Escribirle a @${i.usuario}: hizo el diagnóstico en la web`,
    descripcion: [
      `**${quien}** pidió el diagnóstico gratis de Instagram en jdmedia.com.ar y le dio **${i.puntaje}/100**. Es un contacto caliente: ya sabe que algo le falta.`,
      "",
      "**Lo que le falta a su cuenta:**",
      ...i.mejoras.map((m) => `- ${m}`),
      "",
      `**Mensaje listo para mandarle por Instagram** (instagram.com/${i.usuario}):`,
      "",
      `> ${mensaje}`,
      "",
      "**Quién lo hace:** comercial.",
      "**Está hecho cuando:** le escribiste hoy y anotaste la respuesta en su contacto de Comercial.",
    ].join("\n"),
  };
}
