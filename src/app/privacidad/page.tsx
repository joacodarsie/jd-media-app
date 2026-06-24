import type { Metadata } from "next";
import { AGENCY } from "@/lib/agency";

export const metadata: Metadata = {
  title: "Política de Privacidad — JD Media",
  description:
    "Cómo JD Media trata los datos de su plataforma interna y de las cuentas de redes sociales que los clientes conectan para sus reportes.",
};

const CONTACTO = "agenciajdmedia@gmail.com";
const ACTUALIZADO = "24 de junio de 2026";

export default function PrivacidadPage() {
  return (
    <main className="mx-auto max-w-3xl px-5 py-12 text-[15px] leading-relaxed text-zinc-800">
      <h1 className="text-3xl font-bold text-zinc-900">Política de Privacidad</h1>
      <p className="mt-1 text-sm text-zinc-500">Última actualización: {ACTUALIZADO}</p>

      <Section title="Quiénes somos">
        <p>
          {AGENCY.brand} es una agencia de marketing digital. Operamos una
          plataforma interna de gestión para coordinar el trabajo de nuestro
          equipo y los servicios que prestamos a nuestros clientes. Esta política
          explica qué datos tratamos y con qué fin. Responsable:{" "}
          {AGENCY.representante} ({AGENCY.brand}).
        </p>
      </Section>

      <Section title="Qué datos tratamos">
        <ul className="ml-5 list-disc space-y-1.5">
          <li>
            <b>Datos de la operación:</b> información de nuestro equipo y de las
            cuentas de clientes (tareas, contenidos, facturación interna) que
            cargamos para gestionar el trabajo.
          </li>
          <li>
            <b>Datos de cuentas de redes conectadas:</b> cuando un cliente
            autoriza su cuenta de Instagram o TikTok, accedemos a métricas{" "}
            <b>de solo lectura</b> de esa cuenta —nombre de usuario, foto,
            cantidad de seguidores, y vistas/me gusta/comentarios de sus
            publicaciones— con el único fin de armar su <b>reporte mensual de
            resultados</b>.
          </li>
        </ul>
      </Section>

      <Section title="Datos de TikTok">
        <p>
          Si conectás una cuenta de TikTok, solicitamos únicamente los permisos{" "}
          <code>user.info.basic</code>, <code>user.info.stats</code> y{" "}
          <code>video.list</code>. Con ellos accedemos a información pública de la
          cuenta (usuario, avatar, seguidores, total de me gusta y cantidad de
          videos) y a las métricas de los videos (vistas, me gusta, comentarios,
          compartidos). <b>No publicamos contenido, no modificamos la cuenta y no
          accedemos a mensajes privados.</b> Usamos estos datos solo para mostrar
          los resultados orgánicos en el reporte del cliente.
        </p>
      </Section>

      <Section title="Cómo guardamos y protegemos los datos">
        <p>
          Los datos se almacenan en una base de datos gestionada con acceso
          restringido. Los tokens de acceso de las cuentas conectadas se guardan
          de forma segura y se usan solo para leer las métricas descritas. No
          vendemos ni cedemos datos a terceros con fines publicitarios.
        </p>
      </Section>

      <Section title="Con quién se comparten">
        <p>
          La información de resultados de una cuenta se muestra al{" "}
          <b>cliente dueño de esa cuenta</b> y al equipo de {AGENCY.brand} que
          trabaja en ella. No compartimos estos datos con nadie más.
        </p>
      </Section>

      <Section title="Cómo revocar el acceso">
        <p>
          Podés desconectar tu cuenta cuando quieras: desde la configuración de
          aplicaciones conectadas de TikTok o Instagram, o escribiéndonos a{" "}
          <a className="text-blue-600 underline" href={`mailto:${CONTACTO}`}>
            {CONTACTO}
          </a>
          . Al revocar el acceso dejamos de obtener nuevas métricas y, si lo
          pedís, eliminamos los datos asociados.
        </p>
      </Section>

      <Section title="Contacto">
        <p>
          Por cualquier consulta sobre esta política o sobre tus datos,
          escribinos a{" "}
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
