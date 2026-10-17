/**
 * Diagnóstico gratis de Instagram para la web (17/10/2026). Sin IA: el puntaje
 * sale de reglas fijas sobre los datos públicos de la cuenta, así no cuesta
 * nada por consulta. Cuatro pilares de 25 puntos cada uno.
 */

export interface PostPublico {
  timestamp: string;
  likes: number | null;
  comentarios: number | null;
  /** IMAGE · VIDEO · CAROUSEL_ALBUM */
  tipo: string;
  /** REELS · FEED */
  producto?: string | null;
}

export interface PerfilPublico {
  usuario: string;
  nombre: string | null;
  biografia: string | null;
  web: string | null;
  seguidores: number;
  publicaciones: number;
  posts: PostPublico[];
}

export type Estado = "bien" | "medio" | "mal";

export interface Pilar {
  clave: "constancia" | "interaccion" | "formatos" | "perfil";
  titulo: string;
  nota: number; // 0 a 25
  estado: Estado;
  dato: string;
  mejora: string;
}

export interface Diagnostico {
  puntaje: number; // 0 a 100
  veredicto: string;
  frase: string;
  pilares: Pilar[];
  mejoras: string[];
  resumen: { postsMes: number; interaccion: number | null; reels: number; diasSinPublicar: number | null };
}

const DIA = 86_400_000;

function estadoDe(nota: number): Estado {
  if (nota >= 19) return "bien";
  if (nota >= 11) return "medio";
  return "mal";
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`;

export function diagnosticar(p: PerfilPublico, ahora = Date.now()): Diagnostico {
  const posts = [...p.posts].sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp));
  const recientes = posts.slice(0, 12);

  // 1. Constancia: cuánto publicó en los últimos 30 días y hace cuánto no publica.
  const postsMes = posts.filter((x) => ahora - Date.parse(x.timestamp) <= 30 * DIA).length;
  const diasSinPublicar = posts.length ? Math.floor((ahora - Date.parse(posts[0].timestamp)) / DIA) : null;
  let constancia = postsMes >= 12 ? 25 : postsMes >= 8 ? 21 : postsMes >= 4 ? 14 : postsMes >= 1 ? 7 : 0;
  if (diasSinPublicar !== null && diasSinPublicar > 14) constancia = Math.min(constancia, 4);
  const datoConstancia =
    diasSinPublicar === null
      ? "Todavía no hay publicaciones"
      : diasSinPublicar > 14
        ? `Hace ${diasSinPublicar} días que no publicás`
        : `${plural(postsMes, "publicación", "publicaciones")} en los últimos 30 días`;

  // 2. Interacción: promedio de me gusta + comentarios sobre los seguidores.
  const conDatos = recientes.filter((x) => x.likes !== null);
  let interaccion: number | null = null;
  let notaInter = 8;
  if (conDatos.length && p.seguidores > 0) {
    const prom = conDatos.reduce((s, x) => s + (x.likes ?? 0) + (x.comentarios ?? 0), 0) / conDatos.length;
    interaccion = Math.round((prom / p.seguidores) * 1000) / 10;
    notaInter = interaccion >= 3 ? 25 : interaccion >= 1.5 ? 20 : interaccion >= 0.8 ? 14 : interaccion >= 0.3 ? 8 : 3;
  }
  const datoInter =
    interaccion === null
      ? "La cuenta oculta los me gusta"
      : `${interaccion.toLocaleString("es-AR")}% de tus seguidores interactúa con cada publicación`;

  // 3. Formatos: qué parte del contenido reciente son reels.
  const reels = recientes.filter((x) => x.producto === "REELS" || x.tipo === "VIDEO").length;
  const pctReels = recientes.length ? reels / recientes.length : 0;
  const carruseles = recientes.some((x) => x.tipo === "CAROUSEL_ALBUM");
  let notaFormatos = pctReels >= 0.4 ? 22 : pctReels >= 0.25 ? 17 : pctReels >= 0.1 ? 10 : 4;
  if (carruseles) notaFormatos += 3;
  if (!recientes.length) notaFormatos = 0;
  const datoFormatos = recientes.length
    ? `${reels} de tus últimas ${recientes.length} publicaciones ${reels === 1 ? "es un reel" : "son reels"}`
    : "Sin publicaciones para medir";

  // 4. Perfil: lo primero que ve alguien que llega a la cuenta.
  const bio = (p.biografia ?? "").trim();
  let notaPerfil = 0;
  const faltan: string[] = [];
  if (bio.length >= 40) notaPerfil += 8;
  else if (bio.length > 0) { notaPerfil += 4; faltan.push("una biografía que diga qué hacés y para quién"); }
  else faltan.push("una biografía");
  if (p.web) notaPerfil += 8;
  else faltan.push("un link para comprar o escribirte");
  if (p.nombre && p.nombre.trim().toLowerCase() !== p.usuario.toLowerCase()) notaPerfil += 4;
  else faltan.push("un nombre que diga qué ofrecés");
  if (p.publicaciones >= 30) notaPerfil += 5;
  else if (p.publicaciones >= 9) notaPerfil += 3;
  const datoPerfil = faltan.length ? `Falta ${faltan[0]}` : "Biografía, link y nombre en orden";

  const pilares: Pilar[] = [
    {
      clave: "constancia",
      titulo: "Constancia",
      nota: constancia,
      estado: estadoDe(constancia),
      dato: datoConstancia,
      mejora:
        diasSinPublicar !== null && diasSinPublicar > 14
          ? "Volver a publicar con un calendario fijo: una cuenta quieta pierde alcance y confianza."
          : "Publicar al menos 3 veces por semana con un calendario: el algoritmo premia la constancia.",
    },
    {
      clave: "interaccion",
      titulo: "Interacción",
      nota: notaInter,
      estado: estadoDe(notaInter),
      dato: datoInter,
      mejora: "Contenido que invite a responder (preguntas, encuestas, juegos) y contestar cada comentario.",
    },
    {
      clave: "formatos",
      titulo: "Formatos",
      nota: Math.min(25, notaFormatos),
      estado: estadoDe(Math.min(25, notaFormatos)),
      dato: datoFormatos,
      mejora: "Sumar más reels: hoy son el formato que más alcance trae a gente que todavía no te sigue.",
    },
    {
      clave: "perfil",
      titulo: "Perfil",
      nota: notaPerfil,
      estado: estadoDe(notaPerfil),
      dato: datoPerfil,
      mejora: faltan.length
        ? `Completar el perfil: ${faltan.join(", ")}.`
        : "Ordenar las historias destacadas por tema: precios, envíos, clientes.",
    },
  ];

  const puntaje = Math.round(pilares.reduce((s, x) => s + x.nota, 0));
  const flojos = [...pilares].filter((x) => x.estado !== "bien").sort((a, b) => a.nota - b.nota);
  const mejoras = flojos.slice(0, 3).map((x) => x.mejora);
  if (!mejoras.length) mejoras.push("Tu cuenta está muy bien: el próximo paso es escalarla con publicidad bien segmentada.");

  const [veredicto, frase] =
    puntaje >= 80
      ? ["Muy bien", "Tu cuenta está en forma. Ahora toca hacerla crecer."]
      : puntaje >= 60
        ? ["Buena base", "Hay una base sólida y varias cosas para ajustar."]
        : puntaje >= 40
          ? ["Con mucho para crecer", "Tu cuenta tiene potencial que hoy no está aprovechando."]
          : ["Necesita atención", "Tu Instagram te puede estar haciendo perder clientes."];

  return {
    puntaje,
    veredicto,
    frase,
    pilares,
    mejoras,
    resumen: { postsMes, interaccion, reels, diasSinPublicar },
  };
}

/** Normaliza lo que escribe la persona: @usuario, el link o el nombre pelado. */
export function usuarioDe(raw: string): string | null {
  let v = (raw ?? "").trim();
  const m = v.match(/instagram\.com\/([^/?#\s]+)/i);
  if (m) v = m[1];
  v = v.replace(/^@+/, "").replace(/\/+$/, "").toLowerCase();
  return /^[a-z0-9._]{1,30}$/.test(v) ? v : null;
}
