/**
 * Prompt + few-shots para generar el diagnóstico inicial con Claude.
 *
 * Se cachea con prompt caching (system + few-shots como un bloque grande),
 * así la generación es barata después de la primera vez.
 */

import { AI_MODEL_SMART } from "@/lib/ai/models";

export const DIAGNOSTIC_GENERATOR_MODEL = AI_MODEL_SMART;

export const DIAGNOSTIC_SYSTEM_PROMPT = `Sos el **analista estratégico** de JD Media, una agencia de marketing digital de Córdoba, Argentina. Tu trabajo es producir un **Diagnóstico Inicial** completo, claro y accionable a partir de la transcripción de un meet de onboarding con un cliente nuevo.

# Quién es JD Media
Agencia de gestión de redes, paid media, producción de contenido, diseño y desarrollo web para PyMEs.
Tono: profesional pero cercano, español rioplatense (vos), directo, sin disclaimers, sin emojis a menos que el ejemplo los pida.

# El informe que tenés que producir
Un documento estratégico de 14 secciones, con DOS audiencias en mente:
1. **El cliente** — lo recibe en PDF, tiene que entenderlo y emocionarse.
2. **El equipo JD Media** — lo va a usar como brief permanente. Cada CM/diseñador/estrategia lo lee para ejecutar.
   Y crucialmente: **JDmedIA (IA interna) lo va a consumir** para sugerir calendario, copy, ideas.
   Por eso cada sección tiene que ser específica, sin generalidades vacías.

# Reglas de calidad — NO NEGOCIABLES
- **Cero generalidades**. "Crecer en redes" está prohibido. Decí "Pasar de 1.200 a 3.000 followers en IG en 90 días" o equivalente concreto.
- **Insights, no descripciones**. No repitas lo que el cliente dijo: extraé el patrón. "El cliente vende DJ" → mal. "El cliente vende la seguridad de que la fiesta no falle" → bien.
- **Texto en español rioplatense, vos, sin formalidad acartonada.**
- **Cada problema necesita evidencia** — qué te hace pensar eso (algo del meet, algo del perfil actual).
- **Cada acción del plan tiene que ser ejecutable por una persona en una semana**. Si no, partila.
- **Marcas inspo siempre concretas**, idealmente del mismo rubro o del rubro de "experiencia premium". Nunca inventes nombres.
- **Si la transcripción no menciona algo importante** (ej: público objetivo), no inventes — dejá la sección con lo poco que haya y agregá "Pendiente confirmar con cliente" en \`observaciones\` o similar. NUNCA inventes datos sobre el cliente.

# Estilo de cada sección
- **Resumen ejecutivo**: 3-5 bullets, cada uno una oración punzante. Tiene que poder leerse en 30 segundos.
- **Contexto**: 1 frase para "qué es", 2-3 para historia/brecha. Sin relleno.
- **Problemas y diferenciales**: títulos cortos en mayúscula inicial, descripción de 2-3 oraciones.
- **Plan de acción**: títulos en imperativo ("Clarificar bio de Instagram", "Subir 4 reels de experiencia real por mes"), 8-12 acciones, cada una con \`area_sugerida\` correcta.
- **Pilares de contenido**: SIEMPRE 4. Nombrados con una palabra fuerte. Con ejemplos concretos de qué posteo entra ahí.

# Áreas válidas para area_sugerida
"diseno" | "community" | "produccion" | "paid" | "estrategia" | "desarrollo" | "otro"

# Tu output
Vas a llamar a la tool \`save_diagnostic\` con el JSON estructurado. NO escribas texto fuera de la tool call. NO uses markdown en los strings del JSON salvo donde la UI lo renderice (descripciones largas pueden tener saltos de línea simples \\n).

# IMPORTANTE — formato del JSON
Los campos como \`contexto\`, \`marca\`, \`modelo_negocio\`, \`publico_objetivo\`, \`recursos_limitaciones\`, \`competencia_referencias\` son **OBJETOS anidados con subcampos**, no strings.

❌ MAL:  "contexto": "{\\"que_es\\": \\"...\\", \\"etapa\\": \\"...\\"}"
✅ BIEN: "contexto": { "que_es": "...", "etapa": "..." }

Idem los campos de arrays (\`diferenciales\`, \`problemas\`, \`plan_accion\`, etc.): son **arrays de objetos**, no strings que parezcan arrays.

Devolvé objetos y arrays nativos del JSON. Nunca serialices a string.`;

/**
 * Ejemplos reales de informes pasados, condensados al esqueleto JSON.
 * Sirven para que Claude copie el TONO y la PROFUNDIDAD, no para que copie contenido.
 *
 * Mantenemos esto en un bloque cacheado para no pagar tokens cada vez.
 */
export const DIAGNOSTIC_FEW_SHOT = `# Ejemplos del estilo esperado

## Ejemplo 1 — Sierravista (café-restaurante en Sierras Chicas)

Diferenciales detectados:
- "Ubicación en Sierras Chicas" → No es un restaurante urbano: es una experiencia en un entorno natural. Esto lo posiciona como plan, no solo como salida gastronómica.
- "Experiencia integral" → Acompaña desayuno, almuerzo, merienda y cena. Permite múltiples ocasiones de consumo en un mismo lugar.
- "Propuesta de desconexión" → El valor no está en la comida, sino en lo que genera: pausa, cambio de ritmo.

Problemas detectados (con evidencia):
- "Falta de claridad en la propuesta" → Al ingresar al perfil no queda claro en pocos segundos qué es. Evidencia: bio actual habla de "naturaleza" pero no de qué momentos del día cubre ni cómo reservar.
- "Contenido más visual que estratégico" → Muestra el lugar pero no construye idea de experiencia. Evidencia: últimos 12 posteos = fotos de platos sueltos, cero personas/momentos.

Plan de acción (algunas, no todas):
- "Reescribir bio para que diga qué es + dónde está + cómo reservar" (area_sugerida: estrategia, prioridad: alta)
- "Producir 4 reels mensuales con personas reales viviendo el lugar" (area_sugerida: produccion, prioridad: alta)
- "Crear 6 destacados nuevos: carta, horarios, ubicación, reservas, eventos, experiencia" (area_sugerida: diseno, prioridad: media)

## Ejemplo 2 — DROP Producciones (DJ para fiestas de 15)

Insight clave del público: "No compran un DJ. Compran la seguridad de que la fiesta no va a fallar."

Diferenciales:
- "Energía del evento" → No solo pasa música, maneja la energía del evento.
- "Contenido altamente viralizable" → Gente saltando, momentos épicos, POV del DJ. Producto ideal para redes.

Problemas:
- "No se trabaja el miedo del cliente" → No hay contenido que aborde "¿y si el DJ no levanta?". Evidencia: ningún reel muestra el "antes/después" de una fiesta.

# Reglas clave que se ven en estos ejemplos
- Los diferenciales son **reframes**, no descripciones planas.
- Los problemas tienen **evidencia observable**, no opinión.
- Los insights de público son **psicológicos**, no demográficos.
- Las acciones son **verificables en una semana**.

Aplicá ESTE NIVEL de calidad y especificidad al diagnóstico que vas a generar.`;

/**
 * Tool schema que fuerza al modelo a devolver el diagnóstico estructurado.
 * Espejo del DiagnosticContent de src/lib/diagnostics/schema.ts.
 */
export const SAVE_DIAGNOSTIC_TOOL = {
  name: "save_diagnostic",
  description:
    "Guarda el diagnóstico inicial completo del cliente con las 14 secciones estructuradas.",
  input_schema: {
    type: "object" as const,
    properties: {
      resumen_ejecutivo: {
        type: "object",
        properties: {
          bullets: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 5 },
        },
        required: ["bullets"],
      },
      contexto: {
        type: "object",
        properties: {
          que_es: { type: "string", description: "Una frase: qué es este negocio." },
          etapa: { type: "string", enum: ["arrancando", "crecimiento", "consolidado", "estancado"] },
          historia: { type: "string" },
          brecha_actual: { type: "string", description: "Lo que pasa vs lo que se comunica hoy." },
        },
        required: ["que_es", "etapa", "historia", "brecha_actual"],
      },
      modelo_negocio: {
        type: "object",
        properties: {
          productos_servicios: {
            type: "array",
            items: {
              type: "object",
              properties: { nombre: { type: "string" }, ticket: { type: "string" } },
              required: ["nombre"],
            },
          },
          modalidad: { type: "string" },
          canales_actuales: { type: "array", items: { type: "string" } },
          como_se_vende_hoy: { type: "array", items: { type: "string" } },
          operativo: {
            type: "object",
            properties: {
              quien_atiende: { type: "string" },
              horarios: { type: "string" },
            },
            required: ["quien_atiende", "horarios"],
          },
        },
        required: ["productos_servicios", "modalidad", "canales_actuales", "como_se_vende_hoy", "operativo"],
      },
      publico_objetivo: {
        type: "object",
        properties: {
          segmentos: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nombre: { type: "string" },
                perfil: { type: "string" },
                plan_tipico: { type: "string" },
                valor: { type: "string" },
              },
              required: ["nombre", "perfil", "plan_tipico", "valor"],
            },
          },
          insight_clave: { type: "string", description: "El dolor psicológico central del cliente ideal." },
          anti_publico: { type: "string" },
        },
        required: ["segmentos", "insight_clave", "anti_publico"],
      },
      marca: {
        type: "object",
        properties: {
          personalidad: { type: "array", items: { type: "string" } },
          percepcion_deseada: { type: "string" },
          estado_manual: {
            type: "object",
            properties: {
              logo: { type: "boolean" },
              colores: { type: "boolean" },
              tipografias: { type: "boolean" },
              observaciones: { type: "string" },
            },
            required: ["logo", "colores", "tipografias"],
          },
          tono_voz: {
            type: "object",
            properties: {
              registro: { type: "string", enum: ["formal", "informal", "mixto"] },
              humor: { type: "boolean" },
              frases_representativas: { type: "array", items: { type: "string" } },
            },
            required: ["registro", "humor", "frases_representativas"],
          },
        },
        required: ["personalidad", "percepcion_deseada", "estado_manual", "tono_voz"],
      },
      diferenciales: {
        type: "array",
        items: {
          type: "object",
          properties: { titulo: { type: "string" }, descripcion: { type: "string" } },
          required: ["titulo", "descripcion"],
        },
      },
      problemas: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            descripcion: { type: "string" },
            evidencia: { type: "string" },
          },
          required: ["titulo", "descripcion"],
        },
      },
      competencia_referencias: {
        type: "object",
        properties: {
          competidores: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nombre: { type: "string" },
                fortalezas: { type: "string" },
                debilidades: { type: "string" },
              },
              required: ["nombre", "fortalezas", "debilidades"],
            },
          },
          inspo: {
            type: "array",
            items: {
              type: "object",
              properties: {
                nombre: { type: "string" },
                que_tomar: { type: "string" },
              },
              required: ["nombre", "que_tomar"],
            },
          },
        },
        required: ["competidores", "inspo"],
      },
      objetivos_trimestre: {
        type: "array",
        items: {
          type: "object",
          properties: { titulo: { type: "string" }, descripcion: { type: "string" } },
          required: ["titulo", "descripcion"],
        },
        minItems: 3,
        maxItems: 5,
      },
      pilares_contenido: {
        type: "array",
        items: {
          type: "object",
          properties: {
            nombre: { type: "string" },
            descripcion: { type: "string" },
            ejemplos: { type: "array", items: { type: "string" } },
          },
          required: ["nombre", "descripcion", "ejemplos"],
        },
        minItems: 4,
        maxItems: 4,
      },
      plan_accion: {
        type: "array",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Imperativo, accionable, una persona en una semana." },
            descripcion: { type: "string" },
            area_sugerida: {
              type: "string",
              enum: ["diseno", "community", "produccion", "paid", "estrategia", "desarrollo", "otro"],
            },
            prioridad: { type: "string", enum: ["alta", "media", "baja"] },
          },
          required: ["titulo", "descripcion", "area_sugerida", "prioridad"],
        },
        minItems: 8,
        maxItems: 12,
      },
      recursos_limitaciones: {
        type: "object",
        properties: {
          aporta_cliente: { type: "array", items: { type: "string" } },
          lineas_rojas: { type: "array", items: { type: "string" } },
        },
        required: ["aporta_cliente", "lineas_rojas"],
      },
      proximos_pasos: { type: "array", items: { type: "string" } },
    },
    required: [
      "resumen_ejecutivo",
      "contexto",
      "modelo_negocio",
      "publico_objetivo",
      "marca",
      "diferenciales",
      "problemas",
      "competencia_referencias",
      "objetivos_trimestre",
      "pilares_contenido",
      "plan_accion",
      "recursos_limitaciones",
      "proximos_pasos",
    ],
  },
};

/**
 * Construye el mensaje user con los datos del cliente + la transcripción.
 */
export function buildGenerateUserMessage(args: {
  clienteNombre: string;
  rubro?: string | null;
  pack?: string | null;
  serviciosContratados?: string[];
  redes?: { red: string; handle?: string | null }[];
  transcript: string;
  /** Instrucciones libres del admin para tener en cuenta al generar. */
  instrucciones?: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`# Cliente`);
  lines.push(`Nombre: ${args.clienteNombre}`);
  if (args.rubro) lines.push(`Rubro: ${args.rubro}`);
  if (args.pack) lines.push(`Pack contratado: ${args.pack}`);
  if (args.serviciosContratados && args.serviciosContratados.length > 0) {
    lines.push(`Servicios contratados: ${args.serviciosContratados.join(", ")}`);
  }
  if (args.redes && args.redes.length > 0) {
    lines.push(
      `Redes actuales: ${args.redes.map((r) => `${r.red}${r.handle ? ` (${r.handle})` : ""}`).join(", ")}`
    );
  }
  lines.push("");
  lines.push(`# Transcripción del meet de onboarding`);
  lines.push("");
  lines.push(args.transcript);
  lines.push("");
  const instrucciones = (args.instrucciones ?? "").trim();
  if (instrucciones) {
    lines.push(`# Indicaciones adicionales del equipo (tenelas MUY en cuenta)`);
    lines.push(
      `Priorizá esto por sobre lo genérico, sin inventar datos que no estén en la transcripción:`
    );
    lines.push("");
    lines.push(instrucciones);
    lines.push("");
  }
  lines.push(
    `# Tu tarea
Generá el diagnóstico inicial completo llamando a la tool \`save_diagnostic\` con las 14 secciones. Aplicá las reglas de calidad y el nivel de profundidad de los ejemplos${
      instrucciones ? ", respetando las indicaciones adicionales del equipo" : ""
    }.`
  );
  return lines.join("\n");
}
