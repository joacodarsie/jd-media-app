/**
 * Prompt + tool schema para generar el Plan de Contenido mensual con Claude.
 */

export const CONTENT_PLAN_MODEL = "claude-sonnet-4-6";

export const CONTENT_PLAN_SYSTEM_PROMPT = `Sos el **director de contenido** de JD Media, agencia cordobesa de marketing. Tu tarea: generar un Plan de Contenido para un período (típicamente un mes) que sea **operativo, concreto y respetuoso de la estrategia ya definida en el diagnóstico + las cuotas del pack contratado**.

# Quién consume este plan
- El equipo de JD Media (CM, diseño, audiovisual) lo usa como guía operativa.
- JDmedIA y el "Sugerir con IA" del calendario lo leen automáticamente para que cada pieza encaje.
- El cliente lo recibe en PDF como devolución del mes.

# Lógica de redes en JD Media
Instagram es la red **principal de planificación**. Todo se piensa para IG primero. Después se replica automáticamente:
- **Facebook**: mirror de todo lo que sale en IG (reels, posts, carruseles).
- **TikTok**: mirror solo de reels y posts (no carruseles, no stories).
- **LinkedIn / X / otros**: solo si el cliente lo pidió explícitamente.

Por eso en \`mix_por_red\` cada red tiene un \`rol\`:
- IG = \`"principal"\`
- FB, TikTok = \`"replica"\`

Y en cada \`tema_destacado\` indicás \`red_principal: "instagram"\` y \`redes_replica: ["facebook", "tiktok"]\` (o las que correspondan según el formato).

**No contés piezas por triplicado.** Si el pack incluye 8 reels, eso son 8 reels únicos que se replican en las 3 redes — no 24 reels.

# Reglas duras
1. **Respetá el pack contratado**: las cantidades en \`cadencia\` por red principal tienen que coincidir EXACTAMENTE con las cuotas del pack. No infles. Si el pack incluye 8 reels, el plan dice 8 reels en IG (principal), no 12.
2. **Respetá el diagnóstico aprobado**: los pilares en \`distribucion_pilares\` tienen que ser EXACTAMENTE los mismos del diagnóstico (mismos nombres, idealmente 4).
3. **Mirá el historial reciente**: si en los últimos 60 días faltó volumen en un pilar, este plan tiene que corregirlo. Si hay un pilar saturado, bajar peso.
4. **Mirá lo que ya está planificado**: no propongas temas que ya están agendados.
5. **Temas concretos**, no vagos. "Reel sobre el día a día" está MAL. "Reel de Nico grabando voz en estudio con su productor un domingo" está BIEN.
6. **Sin inventar campañas** que el cliente no mencionó. Si no hay lanzamiento ni efeméride relevante, dejá \`campanas\` vacío.
7. Si vino una **transcripción de meet con el cliente**, priorizá lo que el cliente pidió explícitamente. Sus prioridades > las tuyas.

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
        description: "Cadencia mensual por red social que el cliente usa. La principal es donde se planifica; las réplica son donde se cross-postea automáticamente.",
        items: {
          type: "object",
          properties: {
            red: {
              type: "string",
              enum: ["instagram", "tiktok", "youtube", "facebook", "linkedin", "x"],
            },
            rol: {
              type: "string",
              enum: ["principal", "replica"],
              description: "principal = donde se piensa el contenido; replica = mirror automático.",
            },
            cadencia: {
              type: "object",
              description: "Cantidades mensuales por formato (reel, post, carrusel, story, video_largo, live, otro). Solo se cuentan piezas únicas, no copias en redes espejo.",
              additionalProperties: { type: "number" },
            },
            notas: { type: "string" },
          },
          required: ["red", "rol", "cadencia"],
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
        description: "Temas concretos para nutrir el calendario del período. Cantidad = igual a las piezas únicas del pack (suma de reels + posts + carruseles, sin contar stories).",
        items: {
          type: "object",
          properties: {
            titulo: { type: "string" },
            descripcion: { type: "string" },
            fecha: { type: "string", description: "Fecha sugerida ISO (YYYY-MM-DD) dentro del período. Distribuir homogéneamente." },
            pilar: { type: "string" },
            formato: {
              type: "string",
              enum: ["reel", "post", "carrusel", "story", "video_largo", "live", "otro"],
            },
            red_principal: {
              type: "string",
              enum: ["instagram", "tiktok", "youtube", "facebook", "linkedin", "x"],
              description: "Por defecto instagram salvo que el formato sea especifico de otra red.",
            },
            redes_replica: {
              type: "array",
              items: {
                type: "string",
                enum: ["instagram", "tiktok", "youtube", "facebook", "linkedin", "x"],
              },
            },
          },
          required: ["titulo", "descripcion", "formato", "red_principal", "pilar"],
        },
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
  packDescription: string;
  redesSociales: Array<{ red: string; handle?: string | null; url?: string | null }>;
  diagnostico: Record<string, unknown> | null;
  publicacionesUltimos60d: Array<{ titulo: string; tipo: string; red: string; fecha: string | null }>;
  publicacionesPlanificadas: Array<{ titulo: string; tipo: string; red: string; fecha: string | null; estado: string }>;
  meetTranscript?: string | null;
}): string {
  const lines: string[] = [];
  lines.push(`# Cliente: ${args.clienteNombre}`);
  lines.push(`# Período a planificar: ${args.periodoLabel}`);
  lines.push("");
  lines.push("## Pack y cuotas mensuales (RESPETAR)");
  lines.push(args.packDescription);
  lines.push("");

  if (args.redesSociales && args.redesSociales.length > 0) {
    lines.push("## Redes activas del cliente (handles reales)");
    for (const r of args.redesSociales) {
      const parts = [r.red];
      if (r.handle) parts.push(`@${r.handle.replace(/^@/, "")}`);
      if (r.url) parts.push(`(${r.url})`);
      lines.push(`- ${parts.join(" ")}`);
    }
    lines.push(
      "Si la red no aparece en esta lista, NO la incluyas en el mix ni propongas piezas para ella."
    );
    lines.push("");
  }

  if (args.meetTranscript && args.meetTranscript.trim().length > 50) {
    lines.push("## Transcripción del meet de planificación con el cliente");
    lines.push("Esta es la conversación más reciente con el cliente sobre lo que quiere para este período. Sus pedidos explícitos tienen prioridad.");
    lines.push("");
    lines.push(args.meetTranscript.length > 80_000 ? args.meetTranscript.slice(0, 80_000) : args.meetTranscript);
    lines.push("");
  }

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
    lines.push(`## Historial — últimas ${args.publicacionesUltimos60d.length} publicaciones publicadas (120 días)`);
    for (const p of args.publicacionesUltimos60d) {
      const fecha = p.fecha ? p.fecha.slice(0, 10) : "—";
      lines.push(`- [${fecha}] ${p.tipo}/${p.red}: ${p.titulo}`);
    }
    lines.push("");
    lines.push(
      "Usá este historial para: 1) detectar pilares saturados o desbalanceados, 2) repetir estilos que funcionaron, 3) NO duplicar temas ya tratados recientemente, 4) mantener coherencia con la voz del cliente."
    );
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
