import { ImageResponse } from "next/og";
import { createAdmin } from "@/lib/supabase/admin";

/**
 * La tarjeta que se ve cuando el link se pega en WhatsApp.
 *
 * Importa más de lo que parece: la propuesta se manda por chat, y un link sin
 * preview parece spam. Con esto aparece una placa negra y amarilla con el
 * nombre del negocio adentro — antes de abrirla ya se ve que es para ellos.
 */
export const runtime = "nodejs";
export const alt = "Propuesta de JD MEDIA";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Og({ params }: { params: { token: string } }) {
  let empresa = "tu marca";
  try {
    const { data } = await createAdmin()
      .from("proposals")
      .select("empresa")
      .eq("token", params.token)
      .maybeSingle();
    if (data?.empresa) empresa = String(data.empresa);
  } catch {
    /* si falla, la placa sale igual con el texto genérico */
  }

  // Un nombre muy largo tiene que achicarse o se sale de la placa.
  const tamano = empresa.length > 26 ? 68 : empresa.length > 18 ? 84 : 104;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#0A0A0B",
          padding: "70px 76px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 68,
              height: 68,
              borderRadius: 20,
              background: "#FFD400",
              color: "#000",
              fontSize: 30,
              fontWeight: 900,
            }}
          >
            JD
          </div>
          <div
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: 26,
              letterSpacing: 6,
              fontWeight: 600,
            }}
          >
            JD MEDIA
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#FFD400", fontSize: 30, letterSpacing: 5, fontWeight: 700 }}>
            PROPUESTA PARA
          </div>
          <div
            style={{
              color: "#fff",
              fontSize: tamano,
              fontWeight: 900,
              lineHeight: 1.05,
              marginTop: 14,
            }}
          >
            {empresa}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
          <div style={{ color: "rgba(255,255,255,0.55)", fontSize: 27 }}>
            Estrategia, diseño y contenido que convierte
          </div>
          <div style={{ color: "rgba(255,255,255,0.4)", fontSize: 24 }}>jdmedia.com.ar</div>
        </div>
      </div>
    ),
    size,
  );
}
