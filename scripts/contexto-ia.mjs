#!/usr/bin/env node
/**
 * Arma el CONTEXTO de JD Media para llevarlo a otra IA, y cierra el círculo.
 *
 * Por qué existe: el dueño paga cuatro suscripciones de IA y el contexto del
 * negocio vive en una sola (la memoria de Claude Code). Cuando se queda sin
 * tokens ahí, las otras arrancan de cero y no le sirven para nada.
 *
 * **La sincronización tiene dos sentidos y solo uno se puede automatizar.**
 *
 *   IDA (automática)    la memoria de este proyecto + los números de la base
 *                       → `JD MEDIA - CONTEXTO COMPLETO.md`
 *
 *   VUELTA (un pegado)  lo que pasa en ChatGPT o en Claude web no puede
 *                       escribir en este disco. Por eso existe `BITACORA.md`:
 *                       el dueño pega ahí lo que decidió afuera, y desde la
 *                       próxima corrida eso viaja adentro del contexto y lo
 *                       ven las tres. Es el único paso manual que queda.
 *
 * La bitácora NUNCA se pisa: si ya existe, se lee y se respeta.
 *
 * Uso:  node scripts/contexto-ia.mjs   (o doble clic en Actualizar contexto.bat)
 * Sale en:  <Escritorio>/JD Media - Contexto IA/
 *
 * ⚠️ El archivo lleva sueldos del equipo, facturación por cliente y datos de
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

const BITACORA = "BITACORA.md";

const PLANTILLA_BITACORA = `# Bitácora de JD Media

Acá va lo que se decide o se avanza **fuera de Claude Code**: en ChatGPT, en la
otra cuenta de Claude, o en una reunión.

**Cómo se usa:** pegás abajo de todo, sin formato especial. La entrada más nueva
arriba de las viejas o abajo, da igual. Lo importante es que quede escrito.

Cada vez que se actualiza el contexto, lo que esté acá viaja adentro del archivo
que suben las otras IAs. Así las tres se enteran de lo mismo.

**Este archivo no se pisa nunca.** Podés escribir tranquilo.

---

## Entradas

<!-- Pegá acá. Ejemplo de cómo queda una entrada:

### 2026-09-15 · ChatGPT
Definimos que a Brisa se le paga un fijo de $150.000 por dirección creativa,
aparte de lo que diseñe. Falta ver de dónde sale la plata.

-->
`;

/**
 * Lee la bitácora del dueño y la crea si no existe.
 *
 * Es la mitad de vuelta del círculo: lo que pasa en las IAs web no puede
 * escribir en este disco, así que el único puente posible es que él pegue.
 * El trabajo del script es que ese pegado alcance.
 */
function leerBitacora() {
  const p = path.join(SALIDA, BITACORA);
  if (!fs.existsSync(p)) {
    fs.writeFileSync(p, PLANTILLA_BITACORA, "utf8");
    return null;
  }
  const t = fs.readFileSync(p, "utf8");
  // Lo que hay debajo de "## Entradas" es lo que escribió él.
  const i = t.indexOf("## Entradas");
  const cuerpoBit = (i === -1 ? t : t.slice(i + "## Entradas".length))
    .replace(/<!--[\s\S]*?-->/g, "")
    .trim();
  return cuerpoBit.length > 0 ? cuerpoBit : null;
}

/** Lo que está abierto hoy: sale de la base, no de lo que uno se acuerde. */
async function queEstaAbierto() {
  const users = await consultar("users?select=id,nombre&activo=eq.true");
  const tareas = await consultar(
    "tasks?select=numero,titulo,fecha_limite,asignado_a_id,estado&estado=eq.pendiente&order=fecha_limite"
  );
  if (!users || !tareas) return "";
  const nm = Object.fromEntries(users.map((u) => [u.id, u.nombre]));
  const duenio = users.find((u) => /Joaqu/i.test(u.nombre));
  const mias = duenio ? tareas.filter((t) => t.asignado_a_id === duenio.id) : [];
  if (mias.length === 0 && tareas.length === 0) return "";

  const lista = (arr, n = 10) =>
    arr
      .slice(0, n)
      .map(
        (t) =>
          `- **JD-${t.numero}** · ${t.titulo}${t.fecha_limite ? ` _(${t.fecha_limite})_` : ""}${
            !duenio || t.asignado_a_id === duenio.id ? "" : ` — ${nm[t.asignado_a_id] ?? "sin dueño"}`
          }`
      )
      .join("\n");

  // Vencidas y por vencer son dos cosas distintas: mezclarlas hace que una tarea
  // de julio aparezca como "lo próximo", que fue justo lo que salió mal.
  const delEquipo = tareas.filter((t) => !duenio || t.asignado_a_id !== duenio.id);
  const vencidas = delEquipo.filter((t) => t.fecha_limite && t.fecha_limite < hoy);
  const porVenir = delEquipo.filter((t) => !t.fecha_limite || t.fecha_limite >= hoy);

  return `## Qué está abierto ahora mismo

### Lo que tiene Joaquín en su lista
${mias.length ? lista(mias, 12) : "_Nada pendiente a su nombre._"}

### Lo próximo a vencer en el equipo
${porVenir.length ? lista(porVenir) : "_Nada en los próximos días._"}

### Atrasado
${
  vencidas.length
    ? `**${vencidas.length} tareas vencidas.** Las más viejas:\n\n${lista(vencidas, 5)}`
    : "_Nada vencido._"
}

_De ${tareas.length} tareas pendientes en total._

> Estos son los tickets de la plataforma. Lo que se está **discutiendo** y todavía
> no es una tarea está en los primeros temas del contexto de más abajo: son los
> más recientes y arrancan con ⭐.
`;
}

async function main() {
  fs.mkdirSync(SALIDA, { recursive: true });
  const { vigentes, historicos } = clasificar();
  const foto = await fotoDelNegocio();
  const abierto = await queEstaAbierto();
  const bitacora = leerBitacora();

  const norte = cuerpo("project_jd_media_objetivos_2026_q4.md");

  const arranque = `# JD Media — Todo el contexto del proyecto
_Generado el ${hoy}._

## Leé esto primero

Sos el asesor y la mano derecha de **Joaquín Darsie**, dueño de **JD Media**, una
agencia de marketing digital de Córdoba, Argentina. Este archivo tiene todo el
contexto del negocio: los números, el equipo, las decisiones tomadas, lo que está
abierto y cómo trabaja él.

Con esto alcanza para seguir cualquier conversación sobre la agencia sin que
Joaquín tenga que explicarte nada. **No le pidas que te ponga en contexto: ya
está todo acá abajo.**

Tu trabajo no es esperar órdenes. Es mirar los números, decirle qué sigue, y
marcarle lo que no está pasando aunque no lo pregunte.

## Antes de terminar, dejale la entrada para la bitácora

Joaquín trabaja el mismo proyecto en tres IAs a la vez. Vos no ves lo que pasa
en las otras, y las otras no ven esto. El único puente es él.

Por eso: **cada vez que en esta conversación se decida algo, se cambie un número
o quede algo pendiente, cerrá tu respuesta con un bloque así**, listo para que lo
copie de una:

\`\`\`
### ${hoy} · [dónde estás: ChatGPT / Claude]
- Qué se decidió:
- Qué cambió:
- Qué queda pendiente:
\`\`\`

Corto, tres o cuatro líneas. Él lo pega en \`BITACORA.md\` y desde la próxima
actualización lo ven las tres. **Si no lo hacés, ese avance se pierde.**

No lo pongas en cada respuesta: solo cuando pasó algo que vale la pena guardar.

${foto}
${abierto}${
    bitacora
      ? `---

## Lo que se avanzó en otras IAs y en reuniones

Esto lo fue anotando Joaquín fuera de la plataforma. Es tan válido como el resto
del contexto, y suele ser **lo más nuevo de todo**: ante una contradicción con lo
de más abajo, manda esto.

${bitacora}

`
      : ""
}
---

${norte ? `## El norte\n\n${norte.texto}\n\n---\n` : ""}
${COMO_TRABAJAR}

---

# El contexto completo

Lo que sigue son los ${vigentes.length} temas vigentes del proyecto, cada uno con
su detalle: backlog, costeo, finanzas, retención, roles, decisiones y las cosas
que costó descubrir. Es largo a propósito. No hace falta leerlo entero de una:
buscá el tema cuando lo necesites.`;

  const contexto = juntar(vigentes, arranque);

  const historico = juntar(
    historicos,
    `# JD Media — Archivo histórico
_Generado el ${hoy}._

Sesiones anteriores, de más nueva a más vieja. Sirven para rastrear por qué se
decidió algo. **Pueden estar superadas: ante una contradicción, mandan el BRIEF
y el CONTEXTO.**`
  );

  const instrucciones = `# Cómo seguir la conversación en otra IA
_Generado el ${hoy}._

## Son dos pasos

1. Abrí un chat nuevo en **Claude** o en **ChatGPT**.
2. Adjuntá el archivo **\`JD MEDIA - CONTEXTO COMPLETO.md\`** y escribí:

> Seguimos con JD Media.

Listo. El archivo arranca diciéndole qué es, quién sos y qué tiene que hacer.

## Si vas a usarlo seguido, conviene un proyecto

Así no subís el archivo cada vez:

- **Claude** → Proyectos → Crear proyecto "JD Media" → en **Conocimiento**, subí el archivo.
- **ChatGPT** → Proyectos → Nuevo proyecto "JD Media" → subilo a los archivos del proyecto.

Después, cada chat dentro de ese proyecto ya lo tiene.

## Tu segunda cuenta de Claude Code no necesita nada

La memoria del proyecto vive en una carpeta del disco de esta computadora, no
adentro de la cuenta. Si abrís Claude Code acá con la otra cuenta, lee los mismos
archivos y sigue donde quedaste.

---

# Que las tres estén siempre al día

## El círculo, en dos movimientos

**Lo que sale de acá (automático).** Todo lo que se decide en Claude Code, más los
números de la base, entran solos en el archivo de contexto cada vez que lo
actualizás.

**Lo que vuelve de afuera (un pegado).** ChatGPT y Claude web no pueden escribir
en tu computadora. Nadie puede hacer que eso sea automático. Lo que sí se puede es
que te cueste diez segundos:

1. Cuando en ChatGPT o en Claude decidan algo, la IA te va a cerrar con un bloque
   **"entrada para la bitácora"**. Está pedido dentro del archivo de contexto.
2. Copiás ese bloque y lo pegás al final de **\`BITACORA.md\`**, en esta carpeta.
3. Doble clic en **\`Actualizar contexto.bat\`**.

Listo: desde ese momento las tres saben lo mismo. La bitácora viaja adentro del
archivo de contexto, arriba de todo, marcada como lo más nuevo.

\`BITACORA.md\` **nunca se pisa**. Escribí tranquilo.

## Tus dos cuentas de Claude Code ya están sincronizadas

No hace falta bitácora entre ellas. La memoria del proyecto vive en una carpeta
del disco de esta computadora, así que las dos leen y escriben lo mismo.

## Si avanzás con código en ChatGPT

Que lo escriba, pero **aplicalo desde Claude Code**. Es el único que ve el
repositorio de verdad y que corre las pruebas antes de publicar. Pegá lo que te
dio y pedile que lo revise contra el código real: casi siempre hay algo que
ajustar, porque ChatGPT no ve los archivos.

## Qué conviene hacer en cada lado

| Dónde | Para qué |
|---|---|
| **Claude Code** | Todo lo que toca la plataforma, la base y los números reales: construir, medir, aplicar, publicar. |
| **Las otras** | Pensar, redactar, analizar, propuestas, guiones, discutir decisiones. |

## Y un archivo más, que casi nunca vas a necesitar

\`HISTORICO.md\` tiene las sesiones viejas. Solo sirve para rastrear por qué se
decidió algo hace meses. No hace falta subirlo.
`;

  const bat = `@echo off
chcp 65001 >nul
title Actualizar contexto de JD Media
echo.
echo   Actualizando el contexto de JD Media...
echo.
cd /d "${RAIZ}"
node scripts/contexto-ia.mjs
echo.
echo   Listo. Podes cerrar esta ventana.
pause
`;

  const salidas = [
    ["JD MEDIA - CONTEXTO COMPLETO.md", contexto],
    ["LEEME.md", instrucciones],
    ["HISTORICO.md", historico],
  ];

  for (const [nombre, texto] of salidas) {
    fs.writeFileSync(path.join(SALIDA, nombre), texto, "utf8");
    const kb = (Buffer.byteLength(texto, "utf8") / 1024).toFixed(0);
    const tok = Math.round(texto.length / 4).toLocaleString("es-AR");
    console.log(`  ${nombre.padEnd(34)} ${kb.padStart(5)} KB   ~${tok} tokens`);
  }
  // El .bat va en latin1: cmd.exe no lee UTF-8 con BOM y rompe la ruta.
  fs.writeFileSync(path.join(SALIDA, "Actualizar contexto.bat"), bat, "latin1");
  console.log(`  ${"Actualizar contexto.bat".padEnd(34)}`);

  console.log(`\nListo en: ${SALIDA}`);
  console.log(`${vigentes.length} temas vigentes · ${historicos.length} en el histórico`);
}

main().catch((e) => {
  console.error("Falló:", e.message);
  process.exit(1);
});
