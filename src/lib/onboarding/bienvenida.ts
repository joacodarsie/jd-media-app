// La cadena de mensajes de bienvenida que se manda al grupo de WhatsApp de una
// cuenta nueva, después del pago.
//
// Reescrita el 15/9/2026 con la forma de trabajo actual:
//   · la estructura: project manager (tiempos), dirección creativa
//     (aprobaciones), y el equipo de la cuenta con nombre y apellido de rol;
//   · el arranque de 15 días, con los mismos hitos que arma el ticket de
//     onboarding (lib/retencion/onboarding-15.ts), para que lo que se le promete
//     al cliente sea lo que el equipo tiene cargado;
//   · calendarios por quincena con dos semanas de ventaja;
//   · respuestas dentro de las 24 horas hábiles, para las dos partes;
//   · las jornadas de producción, que se cobran aparte.
//
// Se mandan como mensajes y no como PDF a propósito: el grupo es donde el
// cliente vive la relación con la agencia, cada mensaje se lee en su momento y
// queda a mano para volver a buscarlo. Lo formal ya está en la carta acuerdo.
//
// Módulo PURO: entra el cliente, sus servicios y su equipo; salen los textos.

import { JORNADA_PRECIO_HORA, JORNADA_PRECIO_HORA_EXTRA } from "../jornada";

export interface EquipoBienvenida {
  projectManager: string | null;
  directoraCreativa: string | null;
  communityManager: string | null;
  disenador: string | null;
  editor: string | null;
  mediaBuyer: string | null;
  /** Quien brinda la gestión de WhatsApp y/o el chatter (el "Lo lleva" del servicio). */
  whatsapp?: string | null;
}

export interface EntradaBienvenida {
  /** Nombre de pila de quien recibe el mensaje. */
  contacto: string;
  marca: string;
  servicios: string[];
  /** ¿La gestión de redes incluye la gestión de campañas? (false = el cliente pauta solo) */
  conGestionDeCampanas: boolean;
  equipo: EquipoBienvenida;
  /** Quién firma: el director de la agencia. */
  director: string;
}

const ars = (n: number) => `$${Math.round(n).toLocaleString("es-AR")}`;
const pila = (nombre: string | null) => (nombre ? nombre.trim().split(/\s+/)[0] : null);

export function mensajesDeBienvenida(e: EntradaBienvenida): string[] {
  const svc = new Set(e.servicios);
  const redes = svc.has("gestion_redes");
  const pauta = svc.has("paid_media") || (redes && e.conGestionDeCampanas);
  const contenido = redes || svc.has("edicion_audiovisual");
  const eq = e.equipo;
  const wsp = svc.has("gestion_whatsapp") || svc.has("chatter");
  const queWsp = svc.has("chatter")
    ? svc.has("gestion_whatsapp")
      ? "tu WhatsApp: imagen de marca, estados, grupos y la atención de las consultas"
      : "la atención de las consultas de tu WhatsApp"
    : "tu WhatsApp: imagen de marca, estados y grupos";
  // Si la misma persona dirige lo creativo y lleva el WhatsApp, va en una sola línea.
  const wspEnDireccion =
    wsp && contenido && !!eq.directoraCreativa && !!eq.whatsapp && eq.whatsapp === eq.directoraCreativa;

  // ── 1. Bienvenida y equipo ──
  const equipo: string[] = [];
  if (eq.projectManager) {
    equipo.push(
      `– *${pila(eq.projectManager)}*, project manager: organiza al equipo y cuida que todo salga en tiempo y forma. Es tu referente para fechas, pendientes y dudas del día a día.`
    );
  }
  if (contenido && eq.directoraCreativa) {
    equipo.push(
      `– *${pila(eq.directoraCreativa)}*, dirección creativa: define la línea del contenido y aprueba cada pieza antes de que te llegue.` +
        (wspEnDireccion ? ` También lleva ${queWsp}.` : "")
    );
  }
  if (redes && eq.communityManager) {
    equipo.push(`– *${pila(eq.communityManager)}*, community manager: arma los calendarios, publica y está en el día a día de tus redes.`);
  }
  if (contenido && eq.disenador) equipo.push(`– *${pila(eq.disenador)}*, diseño gráfico.`);
  if (contenido && eq.editor) equipo.push(`– *${pila(eq.editor)}*, edición audiovisual.`);
  if (pauta && eq.mediaBuyer) {
    equipo.push(`– *${pila(eq.mediaBuyer)}*, campañas publicitarias: configura y sigue tus anuncios todos los días.`);
  }

  if (wsp && eq.whatsapp && !wspEnDireccion) {
    equipo.push(`– *${pila(eq.whatsapp)}*, WhatsApp: lleva ${queWsp}.`);
  }

  const m1 = [
    `¡Hola ${e.contacto}! 👋 Bienvenido/a al grupo de trabajo de JD Media.`,
    ``,
    `Te presentamos al equipo que va a llevar ${e.marca}:`,
    ...equipo,
    ``,
    `Y yo, ${pila(e.director)}, acompaño las decisiones importantes.`,
    ``,
    `Este grupo es nuestro canal oficial: por acá coordinamos, te pedimos aprobaciones y te compartimos avances. Respondemos dentro de las 24 horas hábiles, y te pedimos lo mismo, así no se frenan los tiempos 🙌`,
  ].join("\n");

  const mensajes = [m1];

  // ── 2. Los primeros 15 días ──
  const arranque: string[] = [];
  if (redes) {
    arranque.push(
      `Así son los primeros 15 días 👇`,
      ``,
      `Son de preparación: todavía no publicamos. Dejamos todo listo para que lo que salga después tenga sentido.`,
      ``,
      `📍 *Día 1* · Reunión de onboarding: conocemos la marca a fondo, los objetivos y el público.`,
      `📍 *Día 3* · Manual de marca, y la lista del material que vamos a necesitar de tu parte.`,
      `📍 *Día 5* · Te compartimos el calendario de contenidos para que lo apruebes.`,
      `📍 *Día 7* · Recibimos tu material ordenado y renovamos los perfiles.`,
      `📍 *Días 8 al 14* · Diseñamos y editamos las piezas, y te las pasamos para aprobar.`,
      `📍 *Día 15* · Empezamos a publicar.`,
      ``,
      `Por eso el primer mes se publica la mitad del pack: desde el segundo mes va completo.`
    );
    if (pauta) {
      arranque.push(
        ``,
        `📈 En paralelo preparamos las campañas: accesos, página de Facebook, WhatsApp vinculado y la primera campaña lista para salir junto con el contenido.`
      );
    }
  } else if (pauta) {
    arranque.push(
      `Así son los primeros 15 días de las campañas 👇`,
      ``,
      `📍 *Día 1* · Reunión de onboarding: objetivos, público y presupuesto.`,
      `📍 *Días 2 al 7* · Accesos, Business Manager, píxel y WhatsApp vinculado.`,
      `📍 *Días 8 al 14* · Armado de los anuncios, que te pasamos para aprobar.`,
      `📍 *Día 15* · Las campañas salen al aire.`
    );
  }
  if (svc.has("desarrollo_web")) {
    if (arranque.length) arranque.push(``);
    arranque.push(
      `💻 Desarrollo web: relevamiento de lo que necesitás, propuesta de estructura para aprobar y arranque del desarrollo.`
    );
  }
  if (svc.has("diseno_grafico") && !redes) {
    if (arranque.length) arranque.push(``);
    arranque.push(`🎨 Diseño gráfico: brief y referencias, manual de marca y producción de las piezas acordadas.`);
  }
  if (wsp) {
    if (arranque.length) arranque.push(``);
    arranque.push(
      svc.has("gestion_whatsapp")
        ? `💬 WhatsApp: configuramos tu WhatsApp Business con la imagen de la marca y armamos la estrategia de estados y grupos${svc.has("chatter") ? ", y el guion para responder las consultas" : ""}.`
        : `💬 WhatsApp: armamos el guion para responder las consultas y empezamos a atenderlas.`
    );
  }
  if (arranque.length) mensajes.push(arranque.join("\n"));

  // ── 3. Cómo trabajamos mes a mes ──
  if (contenido || pauta) {
    const mes: string[] = [`Y después del arranque, así trabajamos todos los meses 👇`, ``];
    if (redes) {
      mes.push(
        `🗓️ *Calendarios por quincena, con dos semanas de ventaja:* mientras se publica una quincena ya preparamos la siguiente, así te llega todo para aprobar con tiempo.`,
        `✅ *Aprobaciones:* te compartimos por acá cada calendario y las piezas. Cuanto antes nos respondas, antes sale todo.`
      );
    }
    if (contenido) {
      mes.push(
        `📁 *Drive de ${e.marca}:* identidad visual, contenido crudo y piezas finales, para descargar cuando quieras.`
      );
    }
    mes.push(`📊 *Reporte y reunión mensual:* repasamos lo que se hizo, cómo respondió la gente y lo que viene.`);
    if (contenido) {
      mes.push(
        `🎬 *Jornadas de producción:* si querés que vayamos a grabar, se coordinan por acá y se cobran aparte: ${ars(JORNADA_PRECIO_HORA)} la primera hora y ${ars(JORNADA_PRECIO_HORA_EXTRA)} cada hora adicional, más viáticos.`
      );
    }
    mes.push(``, `Si en algún momento tenés una idea o una necesidad puntual, escribinos por acá y la sumamos al calendario 👍`);
    mensajes.push(mes.join("\n"));
  }

  // ── 4. Lo que necesitamos para arrancar ──
  const pedidos: string[] = [];
  if (redes) {
    pedidos.push(`🔑 Accesos a Instagram, Facebook y TikTok (o el usuario, si todavía no existen).`);
  }
  if (pauta) {
    pedidos.push(`🔑 Acceso a tu Business Manager de Meta, y una tarjeta para la pauta. Te recomendamos la de Dólar App: la publicidad no paga el recargo de impuestos.`);
  }
  if (wsp) {
    pedidos.push(`📱 Acceso a tu WhatsApp Business: lo vinculamos como dispositivo, sin cambiar tu número.`);
  }
  if (contenido || svc.has("diseno_grafico")) {
    pedidos.push(`🎨 Tu logo en buena calidad (ideal vectorizado) y los colores o tipografías que ya uses.`);
    pedidos.push(`📂 Fotos y videos que ya tengas de la marca, los productos y el equipo.`);
  }
  if (pedidos.length) {
    mensajes.push(
      [
        `Para arrancar sin trabas, necesitamos que nos compartas:`,
        ...pedidos,
        ``,
        `Lo ideal es por link de Drive o carpeta comprimida, así no se pierde calidad. Con eso ya empezamos a trabajar 🚀`,
      ].join("\n")
    );
  }

  return mensajes;
}
