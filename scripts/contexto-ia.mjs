#!/usr/bin/env node
/**
 * Arma el PAQUETE DE CONTEXTO de JD Media para llevarlo a otra IA.
 *
 * Por qué existe: el dueño paga cuatro suscripciones de IA y el contexto del
 * negocio vive en una sola (la memoria de Claude Code, 86 archivos). Cuando se
 * queda sin tokens ahí, las otras arrancan de cero y no sirven para nada. Esto
 * exporta todo a archivos que se suben una vez como base de conocimiento.
 *
 * Genera tres cosas, de menor a mayor:
 *   1. BRIEF        — lo esencial + los números de HOY sacados de la base.
 *                     Entra en la caja de "instrucciones del proyecto".
 *   2. CONTEXTO     — todo lo vigente. Se sube como archivo de conocimiento.
 *   3. HISTORICO    — las sesiones viejas, por si hace falta rastrear algo.
 *
 * Uso:  node scripts/contexto-ia.mjs
 * Sale en:  <Escritorio>/JD Media - Contexto IA/
 *
 * ⚠️ El paquete lleva sueldos del equipo, facturación por cliente y datos de
 * contacto. Subirlo a un servicio es una decisión del dueño, no del script.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const RAIZ = process.cwd();
const MEM =
  process.env.JD_MEMORIA ??
  path.join(os.homedir(), ".claude", "projects", "C--Users-joaqu", "memory");
const ESCRITORIO = [
  path.join(os.homedir(), "OneDrive", "Desktop"),
  path.join(os.homedir(), "Desktop"),
].find((p) => fs.existsSync(p)) ?? RAIZ;
const SALIDA = path.join(ESCRITORIO, "JD Media - Contexto IA");

const hoy = new Date().toISOString().slice(0, 10);

// ── La base, para que los números no salgan viejos ────────────────────────────
function env() {
  const f = path.join(RAIZ, ".env.local");
  if (!fs.existsSync(f)) return {};
  return Object.fromEntries(
    fs
      .readFileSync(f, "utf8")
      .split(/\r?\n/)
      .filter((l) => l.includes("=") && !l.startsWith("#"))
      .map((l) => {
        const i = l.indexOf("=");
        return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
      })
  );
}

async function consultar(ruta) {
  const e = env();
  if (!e.NEXT_PUBLIC_SUPABASE_URL || !e.SUPABASE_SERVICE_ROLE_KEY) return null;
  try {
    const r = await fetch(`${e.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/${ruta}`, {
      headers: {
        apikey: e.SUPABASE_SERVICE_ROLE_KEY,
        Authorization: `Bearer ${e.SUPABASE_SERVICE_ROLE_KEY}`,
      },
    });
    const j = await r.json();
    return Array.isArray(j) ? j : null;
  } catch {
    return null;
  }
}

const pesos = (n) => "$" + Math.round(n).toLocaleString("es-AR");

/** La foto del negocio hoy. Si la base no responde, se dice y se sigue. */
async function fotoDelNegocio() {
  const clientes = await consultar(
    "clients?select=nombre,estado,monto_mensual,fecha_inicio,fecha_activado,fecha_inactivado,es_interno"
  );
  if (!clientes) return "> ⚠️ No se pudo leer la base al generar esto. Los números de abajo faltan.\n";

  const ext = clientes.filter((c) => !c.es_interno);
  const act = ext.filter((c) => c.estado === "activo");
  const fact = act.reduce((a, c) => a + (Number(c.monto_mensual) || 0), 0);
  const meses = (f) =>
    f ? Math.round(((Date.now() - new Date(f).getTime()) / (30.44 * 864e5)) * 10) / 10 : null;

  const hace90 = Date.now() - 90 * 864e5;
  const bajas = ext.filter(
    (c) => c.fecha_inactivado && new Date(c.fecha_inactivado).getTime() > hace90
  );

  // El usuario técnico de la cuenta de Google no es una persona del equipo.
  const users = ((await consultar("users?select=nombre,rol,rol_secundario,area,email&activo=eq.true")) ?? [])
    .filter((u) => !/^agenciajdmedia/i.test(String(u.nombre)));
  const filas = act
    .sort((a, b) => (meses(a.fecha_inicio ?? a.fecha_activado) ?? 0) - (meses(b.fecha_inicio ?? b.fecha_activado) ?? 0))
    .map(
      (c) =>
        `| ${c.nombre} | ${pesos(Number(c.monto_mensual) || 0)} | ${meses(c.fecha_inicio ?? c.fecha_activado) ?? "?"} meses |`
    )
    .join("\n");

  return `## La foto del negocio al ${hoy}

- **Cuentas activas:** ${act.length}
- **Facturación mensual:** ${pesos(fact)}
- **Bajas en los últimos 90 días:** ${bajas.length}${
    bajas.length ? ` (${pesos(bajas.reduce((a, c) => a + (Number(c.monto_mensual) || 0), 0))} al mes)` : ""
  }
- **Equipo activo:** ${users.length} personas

### La cartera, de la más nueva a la más vieja

| Cuenta | Abono | Antigüedad |
|---|---|---|
${filas}

> ⚠️ **Ninguna de las bajas de los últimos meses pasó de 3,2 meses de antigüedad.** Las cuentas de menos de 3,5 meses de esta tabla son las que están en riesgo.

### Equipo

${users.map((u) => `- **${u.nombre}** — ${u.area}${u.rol_secundario ? ` (${u.rol} + ${u.rol_secundario})` : ""}`).join("\n")}
`;
}

// ── El corpus de memoria ──────────────────────────────────────────────────────

/**
 * Lee MEMORY.md y separa lo VIGENTE de lo histórico.
 *
 * El índice tiene tres bloques: arriba lo vigente, después "## Sesiones" y al
 * final "## Backlog viejo". Se respeta ese corte en vez de inventar uno: es el
 * criterio que ya viene manteniéndose a mano.
 */
function clasificar() {
  const indice = fs.readFileSync(path.join(MEM, "MEMORY.md"), "utf8");
  const lineas = indice.split(/\r?\n/);
  const corteSesiones = lineas.findIndex((l) => /^##\s*Sesiones/i.test(l));
  const corteViejo = lineas.findIndex((l) => /^##\s*Backlog viejo/i.test(l));

  const archivosDe = (desde, hasta) =>
    lineas
      .slice(desde, hasta === -1 ? lineas.length : hasta)
      .flatMap((l) => [...l.matchAll(/\]\(([^)]+\.md)\)/g)].map((m) => m[1]));

  const vigentes = archivosDe(0, corteSesiones === -1 ? lineas.length : corteSesiones);
  const sesiones = corteSesiones === -1 ? [] : archivosDe(corteSesiones, corteViejo);

  // Las sesiones más nuevas siguen siendo contexto vivo: van con lo vigente.
  const RECIENTES = 3;
  return {
    indice,
    vigentes: [...vigentes, ...sesiones.slice(0, RECIENTES)],
    historicos: sesiones.slice(RECIENTES),
  };
}

/**
 * Los `[[enlaces-internos]]` de la memoria no significan nada fuera de acá:
 * en otra IA se leen como ruido. Se pasan a texto legible.
 */
function sinWikilinks(t) {
  return t.replace(/\[\[([^\]]+)\]\]/g, (_, n) => `"${String(n).replace(/-/g, " ")}"`);
}

/** Saca el frontmatter y deja el cuerpo, con el nombre como título. */
function cuerpo(archivo) {
  const p = path.join(MEM, archivo);
  if (!fs.existsSync(p)) return null;
  let t = fs.readFileSync(p, "utf8");
  let titulo = archivo.replace(/\.md$/, "");
  const fm = t.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (fm) {
    const d = fm[1].match(/^description:\s*"?(.+?)"?\s*$/m);
    if (d) titulo = d[1];
    t = t.slice(fm[0].length);
  }
  return { titulo, texto: sinWikilinks(t.trim()), archivo };
}

function juntar(archivos, encabezado) {
  const partes = [encabezado];
  const vistos = new Set();
  for (const a of archivos) {
    if (vistos.has(a)) continue;
    vistos.add(a);
    const c = cuerpo(a);
    if (!c) continue;
    partes.push(`\n\n---\n\n# ${c.titulo}\n\n_(${c.archivo})_\n\n${c.texto}`);
  }
  return partes.join("");
}

// ── El brief: lo que se pega como instrucciones ───────────────────────────────
const COMO_TRABAJAR = `## Cómo trabajar con Joaquín

- **Respuestas cortas.** Titular y dos o tres puntos. El detalle va en el entregable, no en el chat.
- **Plantearle vos los problemas que ves en los datos**, sin que los pida. Espera criterio propio, no ejecución a ciegas.
- **No documentos largos de diagnóstico.** Prefiere resolver de a un paso por vez en la conversación.
- **Se marea con demasiadas secciones y opciones.** Consolidar siempre que se pueda.
- **Le molesta ver el mismo dato dos veces** en una misma vista.
- **No carga datos a mano.** Si algo depende de que él complete una planilla, no va a pasar: hay que automatizarlo.
- En documentos comerciales: tono clásico, poco texto, **nunca citar textualmente al cliente ni marcarle sus errores**.

## Los seis servicios que JD Media vende (y solo estos)

Gestión de redes · Paid Media (Meta, TikTok y Google Ads) · Producción de contenido · Diseño gráfico · Desarrollo web · Botly (bots de WhatsApp).

🔴 **NO vende, aunque suene lógico proponerlo:** SEO, posicionamiento en Google, fichas de Google Business, LinkedIn, email marketing, newsletters, CRM, influencers ni prensa. Ofrecerle algo de esa lista a un prospecto es venderle algo que no existe.

## Reglas de negocio que costaron descubrir

- **Los clientes pagan por adelantado, del 1 al 5.** Al equipo se le paga a mes vencido, el día 7. Por eso la agencia nunca necesitó capital de trabajo.
- **El margen BAJA cuanto más grande es el pack.** Los servicios sin producción (pauta sola, WhatsApp, Botly) son los de mayor margen.
- **El primer mes de una cuenta casi no deja nada** una vez descontado el arranque. Una cuenta recién empieza a rendir en el mes 3, y hasta ahora casi ninguna llegaba.
- **El piso de precio es $370.000** para el pack más básico: por debajo, el primer mes da pérdida.
- Los acuerdos fijos con una persona por una cuenta **le ganan siempre** al modelo de tarifas por pieza.
- La coordinación se paga **solo sobre gestión de redes**, no sobre pauta ni edición suelta.

## Qué puede hacer esta IA y qué no

Esta copia del contexto **no tiene acceso a la base de datos ni al repositorio**. Sirve para pensar, analizar, redactar, preparar propuestas, revisar números que se le peguen y discutir decisiones.

**No puede** aplicar cambios en la plataforma, crear tareas, leer datos frescos ni desplegar. Todo eso se hace en la sesión de Claude Code que tiene el proyecto abierto.

Si en esta conversación se toma una decisión importante, conviene anotarla y pasársela a esa sesión para que quede en la memoria del proyecto. Si no, se pierde.`;

async function main() {
  fs.mkdirSync(SALIDA, { recursive: true });
  const { indice, vigentes, historicos } = clasificar();
  const foto = await fotoDelNegocio();

  const norte = cuerpo("project_jd_media_objetivos_2026_q4.md");

  const brief = `# JD Media — Brief del proyecto
_Generado el ${hoy}. Regenerar con \`node scripts/contexto-ia.mjs\`._

JD Media es una agencia de marketing digital de Córdoba, Argentina. La dirige
Joaquín Darsie. Tiene una plataforma propia (Next.js + Supabase) donde se
gestionan clientes, contenidos, tareas, sueldos y finanzas.

${foto}

---

${norte ? `## El norte\n\n${norte.texto}\n\n---\n` : ""}
${COMO_TRABAJAR}

---

## Qué más hay en el paquete

- **CONTEXTO.md** — todo lo vigente: backlog, costeo, finanzas, retención, roles, decisiones tomadas. Subilo como archivo de conocimiento.
- **HISTORICO.md** — sesiones viejas. Solo si hace falta rastrear por qué se decidió algo.
- **INDICE.md** — el índice de la memoria, con una línea por tema.
`;

  const contexto = juntar(
    vigentes,
    `# JD Media — Contexto vigente
_Generado el ${hoy}. Cada bloque es un tema de la memoria del proyecto._

Esto es lo que está VIGENTE. Lo que quedó superado está en HISTORICO.md.`
  );

  const historico = juntar(
    historicos,
    `# JD Media — Archivo histórico
_Generado el ${hoy}._

Sesiones anteriores, de más nueva a más vieja. Sirven para rastrear por qué se
decidió algo. **Pueden estar superadas: ante una contradicción, mandan el BRIEF
y el CONTEXTO.**`
  );

  const instrucciones = `# Cómo cargar esto en cada IA
_Generado el ${hoy}._

La idea es simple: **el BRIEF va en la caja de instrucciones** (se lee siempre) y
**el CONTEXTO se sube como archivo** (se consulta cuando hace falta). Se hace una
vez por herramienta.

## Claude — la segunda cuenta

1. Proyectos → **Crear proyecto**, llamalo "JD Media".
2. En **Instrucciones del proyecto**, pegá el contenido de \`BRIEF.md\`.
3. En **Conocimiento**, subí \`CONTEXTO.md\`. Si querés el rastro completo, sumá \`HISTORICO.md\`.

## ChatGPT

1. Proyectos → **Nuevo proyecto**, "JD Media".
2. En las **instrucciones del proyecto**, pegá \`BRIEF.md\`.
3. Subí \`CONTEXTO.md\` a los archivos del proyecto.

## Gemini

Gems → **Nuevo Gem** → pegá \`BRIEF.md\` en las instrucciones y subí \`CONTEXTO.md\`.

## La segunda cuenta de Claude Code, en esta misma máquina

No hace falta hacer nada. La memoria del proyecto vive en una carpeta del disco
(\`~/.claude/projects/…/memory\`), no dentro de la cuenta: otra cuenta que abra
Claude Code en esta misma computadora lee los mismos archivos.

---

## Tres cosas que conviene tener claras

**1. Esto lleva datos sensibles.** Adentro hay sueldos del equipo, cuánto factura
cada cliente y datos de contacto. Subirlo a ChatGPT o a Gemini es mandarle esa
información a esas empresas. Conviene revisar antes, en la configuración de cada
una, que el uso de tus datos para entrenamiento esté desactivado.

**2. La sincronización va en un solo sentido.** Lo que decidas en otra IA **no
vuelve solo**. Si ahí sale algo importante, copialo y pasáselo a la sesión de
Claude Code para que quede en la memoria del proyecto. Si no, se pierde.

**3. Esto envejece.** Los números salen de la base el día que se genera. Volvé a
correr \`node scripts/contexto-ia.mjs\` cuando entre o se vaya un cliente, cambie
el equipo, o se tome una decisión grande. Toma unos segundos.

## Qué conviene hacer en cada lado

| Dónde | Para qué sirve |
|---|---|
| **Claude Code** (esta sesión) | Todo lo que toca la plataforma, la base y los números reales: construir, medir, aplicar cambios. |
| **Las otras IAs** | Pensar, redactar, analizar, preparar propuestas y guiones, discutir decisiones, revisar textos. |

Las otras **no pueden** leer la base, tocar el código ni desplegar. Pedirles eso
hace que inventen.
`;

  const salidas = [
    ["LEEME.md", instrucciones],
    ["BRIEF.md", brief],
    ["CONTEXTO.md", contexto],
    ["HISTORICO.md", historico],
    ["INDICE.md", `# JD Media — Índice de la memoria\n_Generado el ${hoy}._\n\n${indice}`],
  ];

  for (const [nombre, texto] of salidas) {
    fs.writeFileSync(path.join(SALIDA, nombre), texto, "utf8");
    const kb = (Buffer.byteLength(texto, "utf8") / 1024).toFixed(0);
    const tok = Math.round(texto.length / 4).toLocaleString("es-AR");
    console.log(`  ${nombre.padEnd(14)} ${kb.padStart(5)} KB   ~${tok} tokens`);
  }
  console.log(`\nListo en: ${SALIDA}`);
  console.log(`Vigentes: ${vigentes.length} temas · Históricos: ${historicos.length}`);
}

main().catch((e) => {
  console.error("Falló:", e.message);
  process.exit(1);
});
