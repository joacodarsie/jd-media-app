/**
 * Devuelve los entregables/alcance de cada servicio contratado.
 * Usado en la carta acuerdo para detallar qué incluye cada servicio.
 * Combina `pack_detalle` (jsonb editable por cliente) con defaults razonables.
 */
import type { ServiceType, ClientService } from "@/lib/types";
import { PACK_DEFAULTS } from "@/lib/constants";

export function getDeliverables(svc: ClientService): string[] {
  switch (svc.tipo as ServiceType) {
    case "gestion_redes":
      return gestionRedesDeliverables(svc);
    case "paid_media":
      return [
        "Setup y verificación de Business Manager / Google Ads.",
        "Configuración de píxel y eventos de conversión.",
        "Estructura de campañas según objetivos acordados (leads, ventas o tráfico).",
        "Optimización continua y reporting mensual de resultados.",
        "La inversión publicitaria se factura aparte y no está incluida en este honorario.",
      ];
    case "edicion_audiovisual":
      return [
        "Edición de piezas audiovisuales según calendario acordado.",
        "Coordinación de una jornada de producción mensual.",
        "Entrega de material editado para publicación en redes.",
      ];
    case "branding":
      return [
        "Sesión de descubrimiento de marca (esencia, valores, propósito).",
        "Estrategia de marca: posicionamiento, propuesta de valor y arquitectura de marca.",
        "Definición de identidad verbal: tono de voz, mensajes clave y narrativa.",
        "Identidad visual: logo / sistema visual, paleta de colores y tipografías.",
        "Manual de marca con guidelines de uso (do's & don'ts).",
        "Entrega de archivos finales en los formatos necesarios.",
        "Revisiones incluidas hasta la versión final aprobada.",
      ];
    case "diseno_grafico":
      return [
        "Piezas gráficas según necesidades acordadas (posts, flyers, presentaciones, brand assets).",
        "Manual de marca visual cuando aplique.",
        "Revisiones incluidas hasta versión final aprobada.",
      ];
    case "desarrollo_web":
      return [
        "Análisis de requerimientos y wireframes.",
        "Desarrollo del sitio según alcance acordado.",
        "Optimización SEO básica y responsive design.",
        "Capacitación al cliente para gestión del sitio (cuando aplique).",
      ];
    case "botly":
      return [
        "Diseño y configuración del flow de Botly.",
        "Integración con WhatsApp Business y/u otros canales.",
        "Mantenimiento y optimización del bot.",
      ];
    case "consultoria":
      return [
        "Reuniones de consultoría según frecuencia acordada.",
        "Análisis y recomendaciones específicas según objetivos.",
        "Entregables documentados de cada instancia.",
      ];
    default:
      return svc.notas ? [svc.notas] : [];
  }
}

function gestionRedesDeliverables(svc: ClientService): string[] {
  const out: string[] = [
    "Manual de marca básico de la cuenta.",
    "Informe diagnóstico inicial, plan de acción y moodboard.",
    "Calendario de contenidos mensual.",
    "Drive ordenado en carpetas de contenido.",
    "Rediseño y optimización de perfiles y biografías.",
    "Publicación del contenido + copys + reposteo a historias.",
    "Resubida de contenido a TikTok cuando aplique.",
    "Reporte mensual de avances, métricas principales y próximos pasos.",
    "Grupo de WhatsApp entre cliente y equipo de JD Media.",
    "Una jornada de producción de contenido mensual.",
  ];

  // Pack_detalle puede tener piezas: posts, historias_dias, reels, carruseles
  const pd = (svc.pack_detalle ?? {}) as Record<string, unknown>;
  const reels = Number(pd.reels ?? 0);
  const carruseles = Number(pd.carruseles ?? pd.posts ?? 0);
  const historias = Number(pd.historias_dias ?? pd.historias ?? 0);

  // Fallback a defaults del pack
  let defReels = reels;
  let defCarruseles = carruseles;
  let defHistorias = historias;
  if (svc.pack && PACK_DEFAULTS[svc.pack]) {
    const def = PACK_DEFAULTS[svc.pack];
    if (!defReels) defReels = def.reels;
    if (!defCarruseles) defCarruseles = def.posts;
    if (!defHistorias) defHistorias = def.historias_dias;
  }

  const piezas: string[] = [];
  if (defReels > 0) piezas.push(`${defReels} reels`);
  if (defCarruseles > 0) piezas.push(`${defCarruseles} carruseles`);
  if (defHistorias > 0) piezas.push(`${defHistorias} historias`);

  if (piezas.length > 0) {
    out.push(`Publicaciones mensuales: ${piezas.join(", ")}.`);
  }
  out.push("Respuesta básica de mensajes y comentarios.");

  return out;
}
