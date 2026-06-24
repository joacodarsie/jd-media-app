import type { Metadata } from "next";
import { AGENCY } from "@/lib/agency";

export const metadata: Metadata = {
  title: "Términos de Servicio — JD Media",
  description:
    "Términos de uso de la plataforma de JD Media y de la conexión de cuentas de redes sociales para reportes.",
};

const CONTACTO = "agenciajdmedia@gmail.com";
const ACTUALIZADO = "24 de junio de 2026";

export default function TerminosPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-[15px] leading-relaxed text-zinc-800">
      <h1 className="text-3xl font-bold text-zinc-900">Términos de Servicio</h1>
      <p className="mt-1 text-sm text-zinc-500">Última actualización: {ACTUALIZADO}</p>

      <Section title="1. Aceptación">
        <p>
          Esta plataforma es operada por {AGENCY.brand} para la gestión interna
          de la agencia y la prestación de servicios a sus clientes. Al usarla,
          aceptás estos términos.
        </p>
      </Section>

      <Section title="2. Uso de la plataforma">
        <p>
          El acceso es para el equipo de {AGENCY.brand} y para los clientes en lo
          que corresponde a sus propias cuentas. Cada usuario es responsable de
          usar la plataforma de forma legítima y de cuidar sus credenciales de
          acceso.
        </p>
      </Section>

      <Section title="3. Conexión de cuentas de redes sociales">
        <p>
          De forma opcional, un cliente puede conectar sus cuentas de Instagram o
          TikTok para que la agencia genere reportes de resultados. La conexión se
          hace mediante la autorización oficial de cada plataforma (OAuth) y se
          limita a la lectura de métricas, según se detalla en la{" "}
          <a className="text-blue-600 underline" href="/privacidad">
            Política de Privacidad
          </a>
          . El cliente puede revocar el acceso en cualquier momento.
        </p>
      </Section>

      <Section title="4. Datos y privacidad">
        <p>
          El tratamiento de datos se rige por nuestra{" "}
          <a className="text-blue-600 underline" href="/privacidad">
            Política de Privacidad
          </a>
          . No vendemos ni cedemos datos a terceros con fines publicitarios.
        </p>
      </Section>

      <Section title="5. Disponibilidad">
        <p>
          Procuramos que el servicio esté disponible y sea confiable, pero puede
          tener interrupciones por mantenimiento o causas ajenas. No garantizamos
          disponibilidad ininterrumpida.
        </p>
      </Section>

      <Section title="6. Cambios">
        <p>
          Podemos actualizar estos términos. La versión vigente es la publicada en
          esta página, con su fecha de última actualización.
        </p>
      </Section>

      <Section title="7. Contacto">
        <p>
          Consultas a{" "}
          <a className="text-blue-600 underline" href={`mailto:${CONTACTO}`}>
            {CONTACTO}
          </a>
          .
        </p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7">
      <h2 className="mb-2 text-lg font-semibold text-zinc-900">{title}</h2>
      <div className="space-y-2 text-zinc-700">{children}</div>
    </section>
  );
}
