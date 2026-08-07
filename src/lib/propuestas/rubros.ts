/**
 * Fichas por rubro para la propuesta comercial.
 *
 * Por qué existe: cuando alguien responde el mensaje en frío con "mandame una
 * propuesta", lo que convierte no es un folleto genérico sino un documento que
 * demuestre que entendemos SU negocio. Pero pedirle eso a la IA en cada
 * propuesta cuesta tokens y devuelve texto blando y repetido.
 *
 * Entonces: el diagnóstico y las ideas de cada rubro están escritos a mano acá
 * (cuestan cero y no alucinan), y la IA queda como un botón opcional para el
 * prospecto que valga la pena.
 *
 * Regla de honestidad: nada acá promete resultados numéricos ni menciona
 * clientes que no existen. Solo describe el rubro y lo que efectivamente
 * hacemos — ver `lib/prospecting/catalogo.ts` para el porqué de esa regla.
 */

export type PackSlug = "presencia" | "crecimiento" | "escala";

export interface RubroPropuesta {
  slug: string;
  /** Cómo se nombra el rubro dentro del documento. */
  nombre: string;
  /** Si alguna de estas palabras aparece en el rubro de la campaña, entra esta ficha. */
  claves: string[];
  /** Titular de la portada, debajo del nombre de la empresa. */
  titular: string;
  /** El diagnóstico: qué le pasa hoy a un negocio de este rubro. */
  diagnostico: string;
  /** Ideas de contenido concretas y creíbles del rubro. */
  ideas: string[];
  /** Servicios sugeridos (slugs de la tabla `services`), en orden de prioridad. */
  servicios: string[];
  /** Pack recomendado por defecto. */
  pack: PackSlug;
  /** Experiencia real en rubros parecidos. Vacío = no decimos nada. */
  experiencia?: string;
}

export const RUBRO_GENERICO: RubroPropuesta = {
  slug: "generico",
  nombre: "tu negocio",
  claves: [],
  titular: "Una marca que se ve profesional vende distinto",
  diagnostico:
    "La mayoría de los negocios publica cuando se acuerda, sin un plan atrás. El resultado es un perfil que no transmite el nivel real del trabajo: el cliente entra, no entiende qué ofrecés ni por qué elegirte, y se va. No es un problema de esfuerzo, es de sistema.",
  ideas: [
    "Una serie que muestre cómo trabajás por dentro: lo que hacés bien y nadie ve",
    "Preguntas frecuentes respondidas en video, que es lo que te consultan todos los días",
    "Clientes contando su experiencia, con su cara y sus palabras",
  ],
  servicios: ["gestion_redes", "paid_media", "produccion_contenido", "diseno_grafico"],
  pack: "presencia",
};

export const RUBROS: RubroPropuesta[] = [
  {
    slug: "hoteleria",
    nombre: "hotelería y hospedajes",
    claves: ["hotel", "hospedaje", "hosteria", "cabaña", "cabana", "alojamiento", "posada", "turismo", "apart"],
    titular: "El huésped elige con los ojos, y elige antes de escribirte",
    diagnostico:
      "Nadie reserva un lugar que no vio. Tu Instagram es la recepción antes de la recepción: si las fotos son las mismas de hace tres años y no se entiende cómo es despertarse ahí, la reserva se la lleva el que sí lo muestra. La competencia no es el hotel de al lado, es el que aparece mejor en el celular.",
    ideas: [
      "Recorrido en video de cada tipo de habitación, filmado como lo mira un huésped",
      "El desayuno y los rincones que la gente fotografía cuando llega",
      "Qué hacer en la zona en 48 horas: te posiciona como anfitrión, no como alojamiento",
      "Reseñas reales en placa, que es la prueba que más pesa antes de reservar",
    ],
    servicios: ["gestion_redes", "produccion_contenido", "paid_media", "desarrollo_web"],
    pack: "crecimiento",
    experiencia: "Trabajamos con marcas de turismo y experiencias en Córdoba.",
  },
  {
    slug: "gastronomia",
    nombre: "gastronomía",
    claves: ["restaurante", "bar", "cafeteria", "cafe", "gastronom", "cerveceria", "parrilla", "pizzeria", "heladeria", "panaderia", "pasteleria", "food"],
    titular: "El plato entra por Instagram antes que por la mesa",
    diagnostico:
      "En gastronomía la decisión se toma en dos minutos y en el celular: alguien busca dónde comer, entra a tu perfil y decide. Si lo último que subiste es de hace tres semanas y no se ve el plato como se ve en la mesa, ya perdiste el turno. El local puede estar impecable y aun así no llegar la gente.",
    ideas: [
      "Video corto del plato saliendo de cocina — el formato que más alcance orgánico da hoy",
      "La historia de un plato de la carta: de dónde salió y por qué está ahí",
      "El equipo trabajando en el horario pico, que es lo que genera ganas de ir",
      "Promo del día en historias, con el mismo diseño todas las semanas para que se reconozca",
    ],
    servicios: ["gestion_redes", "produccion_contenido", "paid_media", "botly"],
    pack: "crecimiento",
    experiencia: "Llevamos las redes de marcas gastronómicas en Córdoba.",
  },
  {
    slug: "salud",
    nombre: "salud y consultorios",
    claves: ["odontolog", "dental", "dentista", "clinica", "consultorio", "medico", "salud", "kinesio", "psicolog", "nutricion", "oftalmolog", "dermatolog"],
    titular: "El paciente elige por confianza, y la confianza se construye antes de la consulta",
    diagnostico:
      "En salud nadie compra por precio: elige a quien le da seguridad. Hoy el paciente te googlea, entra a tu Instagram y decide si va o no. Un perfil vacío o con placas genéricas de banco de imágenes transmite lo contrario de lo que hace falta. Y lo que más frena la consulta no es la plata: es el miedo, que se resuelve mostrando y explicando.",
    ideas: [
      "El profesional explicando en 40 segundos la duda que le consultan todos los días",
      "Cómo es el tratamiento paso a paso: lo que más baja el miedo del que duda",
      "Antes y después con el consentimiento correspondiente, que es la prueba más fuerte del rubro",
      "El consultorio por dentro: limpieza, equipamiento y trato, que es lo que se está comprando",
    ],
    servicios: ["gestion_redes", "paid_media", "produccion_contenido", "botly"],
    pack: "crecimiento",
    experiencia: "Trabajamos con profesionales e instituciones de salud en Córdoba.",
  },
  {
    slug: "arquitectura",
    nombre: "arquitectura y diseño",
    claves: ["arquitectura", "arquitecto", "diseño de interiores", "diseno de interiores", "interiorismo", "estudio de diseño", "estudio de diseno", "mobiliario", "paisajismo"],
    titular: "Tu mejor obra no sirve de nada si nadie la vio",
    diagnostico:
      "El estudio de arquitectura vive del boca en boca, y el boca en boca hoy pasa por Instagram: alguien ve una obra, entra al perfil y decide si te escribe. El problema típico no es la falta de trabajo bueno, es que las obras quedan en la carpeta del celular sin editar. Un proyecto bien contado te trae los tres siguientes.",
    ideas: [
      "El antes y después de una obra, que es el formato que más se comparte del rubro",
      "El proceso: del boceto a la obra terminada, en un carrusel",
      "El detalle que nadie nota y explica por qué cobrás lo que cobrás",
      "Recorrido en video del proyecto terminado, con la voz del arquitecto contándolo",
    ],
    servicios: ["gestion_redes", "produccion_contenido", "desarrollo_web", "diseno_grafico"],
    pack: "presencia",
    experiencia: "Trabajamos con marcas de construcción, ambientaciones y diseño.",
  },
  {
    slug: "construccion",
    nombre: "construcción y desarrollos",
    claves: ["constructora", "inmobiliaria", "promotora", "desarrollo inmobiliario", "construccion", "loteo", "obra"],
    titular: "Se vende mejor lo que se puede ver avanzar",
    diagnostico:
      "En construcción y desarrollos la venta es larga y el comprador desconfía: está poniendo mucha plata en algo que todavía no existe. Lo que destraba esa desconfianza es ver el avance, el equipo y las obras entregadas. Casi ninguna empresa del rubro lo muestra, y ahí está la ventaja para el que sí lo hace.",
    ideas: [
      "Avance de obra mensual, siempre desde el mismo ángulo: engancha y demuestra cumplimiento",
      "Entrega de una unidad terminada con la familia recibiendo las llaves",
      "Cómo se financia, explicado simple: es la pregunta que frena el 80% de las consultas",
      "El equipo de obra y los materiales, que es lo que sostiene el precio",
    ],
    servicios: ["gestion_redes", "paid_media", "produccion_contenido", "desarrollo_web"],
    pack: "crecimiento",
    experiencia: "Trabajamos con empresas de construcción en Córdoba.",
  },
  {
    slug: "educacion",
    nombre: "educación y formación",
    claves: ["academia", "idiomas", "instituto", "educativ", "curso", "capacitacion", "escuela", "colegio", "ingles"],
    titular: "La inscripción se decide mirando quién enseña",
    diagnostico:
      "En educación se elige por confianza en la persona que da la clase, no por el listado de materias. La mayoría de los institutos publica la grilla y el precio, y compite contra otro que hace lo mismo. El que muestra cómo son sus clases y qué logran sus alumnos se lleva la inscripción, porque el que duda ya vio de qué se trata.",
    ideas: [
      "Un minuto de clase real: es lo único que responde \"¿me va a servir?\"",
      "Alumnos contando dónde estaban antes y qué logran hoy",
      "Tips cortos y útiles del tema que enseñás, que se comparten solos",
      "Cuenta regresiva de inscripciones con fechas y cupos claros",
    ],
    servicios: ["gestion_redes", "paid_media", "produccion_contenido", "botly"],
    pack: "crecimiento",
  },
  {
    slug: "fitness",
    nombre: "gimnasios y centros de entrenamiento",
    claves: ["gimnasio", "gym", "fitness", "crossfit", "entrenamiento", "pilates", "yoga", "natacion"],
    titular: "La gente no se anota a un gimnasio: se anota a un lugar donde se siente cómoda",
    diagnostico:
      "El que busca gimnasio compara tres cosas: precio, distancia y si va a sentirse un extraño adentro. De las tres, la única que podés controlar con contenido es la tercera. Un perfil que solo publica el precio de la cuota compite solo por precio — y siempre hay uno más barato.",
    ideas: [
      "El ambiente en el horario pico: la energía del lugar es el producto",
      "Ejercicio bien hecho vs mal hecho, explicado por un profe del staff",
      "Historias de socios reales, sin cuerpos de catálogo: eso acerca, lo otro aleja",
      "Cómo es el primer día, paso a paso, para el que tiene vergüenza de arrancar",
    ],
    servicios: ["gestion_redes", "paid_media", "produccion_contenido", "botly"],
    pack: "crecimiento",
  },
  {
    slug: "legal",
    nombre: "estudios jurídicos y servicios profesionales",
    claves: ["abogado", "juridic", "estudio contable", "contador", "escribania", "notaria", "consultora", "asesoria"],
    titular: "Al abogado se lo elige por confianza, y hoy la confianza se mira en el celular",
    diagnostico:
      "Nadie contrata un estudio por un aviso. Lo que pasa es esto: alguien tiene un problema, pregunta, le pasan tu nombre y entra a ver quién sos. Si no encuentra nada, la recomendación se enfría. Un perfil que explica derechos con claridad convierte esa búsqueda en una consulta, y encima educa al cliente antes de la primera reunión.",
    ideas: [
      "\"¿Qué hago si…?\": la consulta más frecuente, respondida en 45 segundos",
      "Errores que la gente comete por no consultar a tiempo",
      "Quiénes son los profesionales del estudio, con nombre y especialidad",
      "Novedades de la ley traducidas a criollo, que es lo que nadie hace",
    ],
    servicios: ["gestion_redes", "diseno_grafico", "desarrollo_web", "paid_media"],
    pack: "presencia",
  },
  {
    slug: "automotor",
    nombre: "automotor",
    claves: ["automotr", "automotor", "lubricentro", "taller", "auto", "vehiculo", "neumatico", "gomeria", "concesionaria", "polarizado", "detailing"],
    titular: "El cliente vuelve al taller en el que confía, y la confianza se muestra",
    diagnostico:
      "En el rubro automotor el cliente no entiende lo que le hacen al auto, y por eso desconfía del precio. El negocio que muestra el trabajo por dentro —qué se cambió, cómo quedó, por qué convenía— deja de discutir precio y empieza a fidelizar. Además es un rubro donde el antes y después es tan visual que el contenido casi se hace solo.",
    ideas: [
      "Antes y después del trabajo, con el detalle de qué se hizo",
      "Cada cuánto conviene hacer el service, explicado sin vueltas",
      "El error más caro que ves todas las semanas por no mantener el auto",
      "El equipo trabajando: el orden del taller vende tanto como el trabajo",
    ],
    servicios: ["gestion_redes", "paid_media", "produccion_contenido", "botly"],
    pack: "presencia",
    experiencia: "Llevamos las redes de negocios del rubro automotor en Córdoba.",
  },
  {
    slug: "indumentaria",
    nombre: "indumentaria y retail",
    claves: ["indumentaria", "ropa", "moda", "tienda", "boutique", "calzado", "deportiv", "accesorios", "joyeria", "optica"],
    titular: "Se compra lo que se ve puesto, no lo que está colgado",
    diagnostico:
      "En indumentaria el catálogo en percha no vende: vende la prenda puesta, en movimiento y combinada. La mayoría de las tiendas publica foto de producto sobre fondo blanco y compite contra el precio de una tienda más grande. La que muestra cómo se usa y quién lo usa se lleva la venta, aunque salga más caro.",
    ideas: [
      "Probador en video: tres combinaciones con la misma prenda",
      "Lo nuevo de la semana, siempre el mismo día, para que la gente lo espere",
      "Clientas reales con lo que compraron — la prueba social más barata que existe",
      "Envíos y cambios explicados, que es lo que frena la compra online",
    ],
    servicios: ["gestion_redes", "paid_media", "produccion_contenido", "desarrollo_web"],
    pack: "crecimiento",
    experiencia: "Trabajamos con marcas de indumentaria en Córdoba.",
  },
  {
    slug: "eventos",
    nombre: "eventos y ambientaciones",
    claves: ["evento", "ambientacion", "fiesta", "salon", "catering", "casamiento", "cumpleaños", "cumpleanos", "produccion de eventos", "dj"],
    titular: "Se contrata lo que se pudo imaginar",
    diagnostico:
      "El que organiza un evento está comprando algo que todavía no existe: necesita verlo antes para animarse. Por eso en este rubro el contenido no es promoción, es catálogo de posibilidades. Y hay una ventaja enorme: cada evento que hacés genera material de sobra, el problema es que se pierde en el celular sin editar.",
    ideas: [
      "El montaje en time-lapse: de salón vacío a evento armado",
      "El detalle que hizo llorar a la familia, contado en 30 segundos",
      "Ideas por temática, para que el cliente entre a elegir",
      "La reacción del cliente cuando entra y lo ve terminado",
    ],
    servicios: ["gestion_redes", "produccion_contenido", "paid_media", "diseno_grafico"],
    pack: "crecimiento",
    experiencia: "Trabajamos con marcas de eventos y ambientaciones en Córdoba.",
  },
  {
    slug: "belleza",
    nombre: "estética y bienestar",
    claves: ["estetica", "peluqueria", "barberia", "spa", "manicur", "belleza", "cosmetolog", "depilacion", "masaje"],
    titular: "El resultado es el mejor anuncio, y lo tenés todos los días",
    diagnostico:
      "En estética el producto es visual y está pasando todo el tiempo en tu local, pero se va sin quedar registrado. La clienta nueva elige mirando resultados de gente parecida a ella; si no los encuentra, va a la que sí los muestra. No hace falta producción cara: hace falta constancia y buena luz.",
    ideas: [
      "Antes y después del mismo día, con la clienta contando cómo se siente",
      "El proceso del tratamiento, que le baja el miedo a la que nunca vino",
      "Cómo mantener el resultado en casa: fideliza y evita reclamos",
      "Disponibilidad de la semana en historias, para llenar los turnos que quedan libres",
    ],
    servicios: ["gestion_redes", "produccion_contenido", "paid_media", "botly"],
    pack: "presencia",
  },
  {
    slug: "servicios_hogar",
    nombre: "servicios para el hogar",
    claves: ["impermeabil", "pintura", "plomeria", "electricidad", "refrigeracion", "climatizacion", "mudanza", "limpieza", "jardineria", "carpinteria", "herreria"],
    titular: "El que muestra el trabajo terminado no compite por precio",
    diagnostico:
      "En servicios para el hogar el cliente pide tres presupuestos y elige por precio, porque no tiene con qué diferenciarlos. La única forma de salir de esa comparación es que vea tu trabajo terminado antes de llamarte: ahí deja de comparar números y empieza a comparar resultados.",
    ideas: [
      "Antes y después de un trabajo, con el problema que había atrás",
      "Cómo se detecta el problema a tiempo, para que no llame cuando ya es tarde",
      "Los materiales que usás y por qué, que justifica la diferencia de precio",
      "Un cliente contando cómo quedó, filmado en el lugar",
    ],
    servicios: ["gestion_redes", "paid_media", "produccion_contenido", "desarrollo_web"],
    pack: "presencia",
    experiencia: "Trabajamos con empresas de servicios y construcción en Córdoba.",
  },
  {
    slug: "ecommerce",
    nombre: "venta online",
    claves: ["ecommerce", "e-commerce", "tienda online", "venta online", "distribuidora", "mayorista", "marketplace"],
    titular: "Vender online es un sistema, no una publicación con suerte",
    diagnostico:
      "En venta online el contenido y la pauta son la misma máquina: el contenido genera confianza y la pauta la pone delante de la gente correcta. Cuando falta una de las dos, se gasta plata en anuncios que llevan a un perfil que no convence, o se hace buen contenido que no lo ve nadie.",
    ideas: [
      "El producto en uso, no en foto de catálogo",
      "Reseñas de compradores en video, aunque sean caseras",
      "Cómo comprar y cuánto tarda el envío, respondido de una",
      "Lo más vendido de la semana, que empuja al que está dudando",
    ],
    servicios: ["paid_media", "gestion_redes", "desarrollo_web", "produccion_contenido"],
    pack: "escala",
  },
  {
    slug: "ong",
    nombre: "fundaciones y organizaciones",
    claves: ["fundacion", "ong", "asociacion civil", "organizacion", "sin fines de lucro", "voluntariado"],
    titular: "La causa se apoya cuando se entiende, y se entiende cuando se cuenta bien",
    diagnostico:
      "Una organización compite por atención con todo lo demás que hay en el celular. Lo que mueve a alguien a colaborar no es el pedido, es entender a quién ayuda y cómo. La mayoría publica el pedido y no la historia, y por eso el mensaje no llega tan lejos como la causa merece.",
    ideas: [
      "Una historia concreta de alguien a quien la organización acompañó",
      "En qué se usa cada peso que entra: es lo que más confianza genera",
      "El trabajo del equipo y los voluntarios, día a día",
      "Fechas clave del calendario de la causa, con contenido preparado antes",
    ],
    servicios: ["gestion_redes", "produccion_contenido", "diseno_grafico", "paid_media"],
    pack: "presencia",
    experiencia: "Acompañamos a fundaciones en su comunicación.",
  },
];

/** Sin acentos, minúsculas, sin puntuación: para comparar rubros escritos a mano. */
function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Elige la ficha que mejor calza con el rubro escrito en la campaña (texto
 * libre, del estilo "Clínicas odontológicas, consultorios dentales privados y
 * centros de estética dental"). Gana la que más palabras clave acierta; si no
 * acierta ninguna, devuelve la genérica, que también sirve.
 */
export function detectarRubro(texto: string | null | undefined): RubroPropuesta {
  const t = normalizar(texto ?? "");
  if (!t) return RUBRO_GENERICO;

  let mejor: RubroPropuesta = RUBRO_GENERICO;
  let mejorPuntaje = 0;
  for (const r of RUBROS) {
    let puntaje = 0;
    for (const clave of r.claves) {
      const c = normalizar(clave);
      if (c && t.includes(c)) puntaje += c.length; // una clave larga vale más que "auto"
    }
    if (puntaje > mejorPuntaje) {
      mejorPuntaje = puntaje;
      mejor = r;
    }
  }
  return mejor;
}

/** Busca una ficha por slug (para regenerar una propuesta ya guardada). */
export function rubroPorSlug(slug: string | null | undefined): RubroPropuesta {
  if (!slug) return RUBRO_GENERICO;
  return RUBROS.find((r) => r.slug === slug) ?? RUBRO_GENERICO;
}

/** Todas las opciones, para el selector cuando se arma una propuesta a mano. */
export function opcionesDeRubro(): { slug: string; nombre: string }[] {
  return [
    ...RUBROS.map((r) => ({ slug: r.slug, nombre: r.nombre })),
    { slug: RUBRO_GENERICO.slug, nombre: "otro rubro" },
  ];
}
