/**
 * Prompt + tool schema para generar el Plan de Contenido mensual con Claude.
 */

export const CONTENT_PLAN_MODEL = "claude-sonnet-4-6";

export const CONTENT_PLAN_SYSTEM_PROMPT = `Sos el **director de contenido** de JD Media, agencia cordobesa de marketing. Tu tarea: generar un Plan de Contenido para un período (típicamente un mes) que sea **operativo, concreto y respetuoso de la estrategia ya definida en el diagnóstico**.

# Quién consume este plan
- El equipo de JD Media (CM, diseño, audiovisual) lo usa como guía operativa.
- JDmedIA y el "Sugerir con IA" del calendario lo leen automáticamente para que cada pieza encaje.

# Reglas duras
1. **Respetá el diagnóstico aprobado**: los pilares de contenido que defina el plan tienen que ser EXACTAMENTE los mismos del diagnóstico (mismos nombres). Si el diagnóstico tiene 4 pilares, la distribución tiene 4 pilares.
2. **Mirá el historial reciente**: si en los últimos 60 días faltó volumen en un pilar, este plan tiene que corregirlo. Si hay un pilar saturado, bajar peso.
3. **Mirá lo que ya está planificado** en el calendario del cliente: no propongas temas que ya están agendados.
4. **Cadencia realista**: considerá los recursos del cliente (líneas rojas, disponibilidad), no propongas 30 reels/mes si el cliente apenas puede grabar 1 por semana.
5. **Temas concretos**, no vagos. "Reel sobre el día a día" está MAL. "Reel de Nico grabando voz en estudio con su productor un domingo" está BIEN.
6. **Mix por red proporcional a la presencia real**: si el cliente no usa LinkedIn, no propongas LinkedIn.
7. **Sin inventar campañas** que el cliente no mencionó. Si no hay lanzamiento ni efeméride relevante, dejá \`campanas\` vacío.

# Tono
Español rioplatense (vos). Directo, accionable, sin generalidades vacías ni emojis.

# Output
Llamás a la tool \`save_content_plan\` con el JSON estructurado. NADA de texto fuera de la tool call.

# IMPORTANTE — formato del JSON
Devolvé objetos y arrays JSON NATIVOS, nunca strings que parezcan JSON.
❌ MAL:  "distribucion_pilares": "[{\\"pilar\\": \\"...\\"}]"
✅ BIEN: "distribucion_pilares": [{ "pilar": "...", "porcentaje": 30, "justificacion": "..." }]`;

export const SAVE_CONTENT_PLAN_TOOL = {
  name: "save_content_plan",
  description: "Guarda el plan de contenido del período con mix, distribución por pilar, temas destacados, campañas y reglas operativas.",
  input_schema: {
    type: "object" as const,
    properties: {
      resumen_mes: {
        type: "array",
        items: { type: "string" },
        minItems: 2,
        maxItems: 4,
        description: "Bullets que resumen lo crítico del plan del período.",
      },
      mix_por_red: {
        type: "array",
        description: "Cadencia mensual por red social que el cliente usa.",
        items: {
          type: "object",
          properties: {
            red: {
              type: "string",
              enum: ["instagram", "tiktok", "youtube", "facebook", "linkedin", "x"],
            },
            cadencia: {
              type: "object",
              description: "Cantidades mensuales por formato (reel, post, carrusel, story, video_largo, live, otro).",
              additionalProperties: { type: "number" },
            },
            notas: { type: "string" },
          },
          required: ["red", "cadencia"],
        },
      },
      distribucion_pilares: {
        type: "array",
        description: "Reparto porcentual por pilar (mismos pilares del diagnóstico, idealmente 4).",
        items: {
          type: "object",
          properties: {
            pilar: { type: "string" },
            porcentaje: { type: "number", minimum: 0, maximum: 100 },
            justificacion: { type: "string" },
          },
          required: ["pilar", "porcentaje", "justificacion"],
        },
      },
      temas_destacados: {
        type: "array",
        description: "5-10 temas concretos para nutrir el calendario del período.",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            descripcion: { type: "string" },
            fecha: { type: "string" },
            pilar: { type: "string" },
          },
          required: ["titulo", "descripcion"],
        },
        minItems: 5,
        maxItems: 10,
      },
      campanas: {
        type: "array",
        description: "Campañas o lanzamientos del período. Vacío si no hay.",
        items: {
          type: "object",
          properties: {
            nombre: { type: "string" },
            objetivo: { type: "string" },
            fechas: { type: "string" },
            piezas_estimadas: { type: "number" },
            formato_principal: {
              type: "string",
              enum: ["reel", "post", "carrusel", "story", "video_largo", "live", "otro"],
            },
            detalle: { type: "string" },
          },
          required: ["nombre", "objetivo", "fechas", "piezas_estimadas", "formato_principal", "detalle"],
        },
      },
      reglas_operativas: {
        type: "array",
        items: { type: "string" },
        description: "Horarios, días fijos, restricciones específicas del período.",
      },
      kpis_objetivo: {
        type: "array",
        items: { type: "string" },
        description: "Lo que vamos a medir al cierre del período. Concreto y numérico cuando aplique.",
      },
      notas: { type: "string" },
    },
    required: [
      "resumen_mes",
      "mix_por_red",
      "distribucion_pilares",
      "temas_destacados",
      "campanas",
      "reglas_operativas",
      "kpis_objetivo",
    ],
  },
};

/**
 * Mensaje user con el contexto completo para generar el plan.
 */
export function buildPlanUserMessage(args: {
  clienteNombre: string;
  periodoLabel: string;
  diagnostico: Record<string, unknown> | null;
  publicacionesUltimos60d: Array<{ titulo: string; tipo: string; red: string; fecha: string | null }>;
  publicacionesPlanificadas: Array<{ titulo: string; tipo: string; red: string; fecha: string | null; estado: string }>;
}): string {
  const lines: string[] = [];
  lines.push(`# Cliente: ${args.clienteNombre}`);
  lines.push(`# Período a planificar: ${args.periodoLabel}`);
  lines.push("");

  if (args.diagnostico) {
    lines.push("## Diagnóstico estratégico (fuente de verdad — RESPETAR)");
    lines.push("");
    lines.push("```json");
    lines.push(JSON.stringify(args.diagnostico, null, 2));
    lines.push("```");
    lines.push("");
  } else {
    lines.push(
      "## Diagnóstico estratégico: NO HAY DIAGNÓSTICO APROBADO. Trabajá con los datos básicos disponibles, pero marcá en `notas` que conviene tener uno."
    );
    lines.push("");
  }

  if (args.publicacionesUltimos60d.length > 0) {
    lines.push(`## Historial — últimas ${args.publicacionesUltimos60d.length} publicaciones publicadas (60 días)`);
    for (const p of args.publicacionesUltimos60d) {
      const fecha = p.fecha ? p.fecha.slice(0, 10) : "—";
      lines.push(`- [${fecha}] ${p.tipo}/${p.red}: ${p.titulo}`);
    }
    lines.push("");
    lines.push("Usá este historial para detectar pilares saturados o desbalanceados. Corregí en el plan.");
    lines.push("");
  }

  if (args.publicacionesPlanificadas.length > 0) {
    lines.push(`## Ya planificadas en el calendario (${args.publicacionesPlanificadas.length})`);
    for (const p of args.publicacionesPlanificadas) {
      const fecha = p.fecha ? p.fecha.slice(0, 10) : "sin fecha";
      lines.push(`- [${fecha} · ${p.estado}] ${p.tipo}/${p.red}: ${p.titulo}`);
    }
    lines.push("");
    lines.push("Tu plan tiene que ABSORBER estas piezas (no duplicarlas) y completar el resto del período.");
    lines.push("");
  }

  lines.push(
    `# Tu tarea\nGenerá el plan de contenido para "${args.periodoLabel}" llamando a la tool \`save_content_plan\`. Aplicá las reglas duras del system.`
  );
  return lines.join("\n");
}
