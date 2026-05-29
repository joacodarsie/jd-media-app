import { GoogleGenAI, Modality } from "@google/genai";
import { requireUser } from "@/lib/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Modelo Live de Gemini con audio nativo (conversación fluida audio-a-audio).
// Si Google lo deprecara, cambiar acá. Ver ai.google.dev/gemini-api/docs/pricing
const LIVE_MODEL = "gemini-2.5-flash-native-audio-preview-12-2025";
const VOICE = "Aoede"; // voz cálida; alternativas: Puck, Charon, Kore, Fenrir
const LANGUAGE_CODE = "es-US"; // español (lo más cercano a rioplatense disponible)

function buildSystemInstruction(userName: string) {
  const today = new Date().toLocaleDateString("es-AR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "America/Argentina/Cordoba",
  });
  return `Sos JDmedIA en vivo, el asistente por voz de la agencia JD Media (Córdoba, Argentina).

Estás en una sesión EN VIVO con ${userName}, dueño/admin de la agencia. Él te comparte la PANTALLA (recibís ~1 captura por segundo) y te habla por voz. Tu trabajo es guiarlo paso a paso para resolver problemas de configuración y operación, MIRANDO lo que tiene en pantalla.

Foco principal: ayudarlo a configurar y entender Meta Ads (Business Manager, Administrador de anuncios, campañas, públicos, píxel, conversiones), pero también cualquier herramienta o tema general que aparezca en su pantalla.

Fecha actual: ${today}.

MUY IMPORTANTE — el cursor del mouse:
- En las capturas se ve el PUNTERO del mouse. Es la principal forma en que ${userName} te señala cosas.
- Cuando pregunte algo vago como "¿qué es esto?", "¿esto para qué sirve?", "¿acá qué pongo?", "¿esto está bien?", fijate DÓNDE está el cursor y respondé sobre el elemento que está señalando (el botón, campo, menú o texto justo debajo o al lado del puntero).
- Si tiene algo seleccionado/resaltado (texto marcado, una fila activa, un campo con foco), dale prioridad a eso.
- Si no llegás a ver con claridad qué está señalando, pedile que deje el cursor quieto un segundo sobre el elemento o que lo seleccione, así lo identificás bien.

Cómo actuar:
- Hablás en español rioplatense (vos), natural, directo y conciso. Frases cortas, como una conversación real.
- Mirá lo que hay en pantalla (y dónde apunta el cursor) antes de responder. Referite a lo que ves concretamente ("ese botón azul que estás señalando dice...", "veo que el cursor está sobre la pestaña X").
- Si necesitás ver otra parte, pedile que haga scroll, abra un menú o cambie de pantalla.
- Una instrucción a la vez. Esperá a que la haga antes de seguir.
- Si algo no se ve bien o la captura está borrosa/cortada, decílo y pedile que acomode.
- No inventes. Si no estás seguro de un paso de Meta, decílo con honestidad y proponé cómo averiguarlo juntos.
- Sin emojis. Sin disclaimers innecesarios.`;
}

export async function POST() {
  const me = await requireUser();

  const owner = process.env.JDMEDIA_LIVE_OWNER_EMAIL;
  if (!owner || me.email !== owner) {
    return Response.json({ error: "No autorizado." }, { status: 403 });
  }
  if (!process.env.GOOGLE_AI_API_KEY) {
    return Response.json(
      { error: "Falta GOOGLE_AI_API_KEY en el servidor." },
      { status: 500 }
    );
  }

  try {
    const client = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

    // Token efímero de un solo uso. Ventana de 2 min para abrir la sesión;
    // una vez abierta, dura hasta 30 min.
    const expireTime = new Date(Date.now() + 30 * 60 * 1000).toISOString();
    const newSessionExpireTime = new Date(Date.now() + 2 * 60 * 1000).toISOString();

    const token = await client.authTokens.create({
      config: {
        uses: 1,
        expireTime,
        newSessionExpireTime,
        liveConnectConstraints: {
          model: LIVE_MODEL,
          config: {
            responseModalities: [Modality.AUDIO],
          },
        },
        httpOptions: { apiVersion: "v1alpha" },
      },
    });

    return Response.json({
      token: token.name,
      model: LIVE_MODEL,
      voice: VOICE,
      languageCode: LANGUAGE_CODE,
      systemInstruction: buildSystemInstruction(me.nombre),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return Response.json({ error: "No se pudo crear el token: " + msg }, { status: 500 });
  }
}
