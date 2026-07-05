import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

/**
 * Cláusulas ESTÁTICAS de la carta acuerdo que el admin puede editar. Las
 * dinámicas (servicios, honorarios, duración, puesta en marcha) NO están acá:
 * dependen de los datos del cliente y se calculan siempre.
 *
 * `default` es el texto vigente (con **negrita** y párrafos separados por línea
 * en blanco). Se usa para pre-cargar el editor. Si el admin guarda un override,
 * la carta usa ese texto; si no, usa el JSX hardcodeado en contract-document.
 */
export interface EditableClause {
  key: string;
  titulo: string;
  default: string;
}

export const EDITABLE_CLAUSES: EditableClause[] = [
  {
    key: "objeto",
    titulo: "Objeto del contrato",
    default:
      "La Agencia se compromete a brindar los servicios contratados por el Cliente, detallados a continuación, con el alcance específico de cada uno.",
  },
  {
    key: "obligaciones",
    titulo: "Obligaciones de las partes",
    default:
      "**La Agencia:** prestar los servicios contratados con profesionalismo, confidencialidad y en los plazos acordados.\n\n**El Cliente:** entregar materiales, accesos e información en tiempo y forma; brindar las autorizaciones necesarias; y efectuar el pago correspondiente en las condiciones establecidas.",
  },
  {
    key: "material",
    titulo: "Material y contenido",
    default:
      "El Cliente compartirá material crudo (fotos, videos, logos, accesos) por los canales acordados. La Agencia es responsable de la edición, optimización y publicación según calendario. El material crudo entregado y las piezas finales producidas son propiedad del Cliente una vez abonados los honorarios del período correspondiente.\n\n**Jornadas de producción audiovisual:** la producción presencial (jornadas de filmación o fotografía en el domicilio del Cliente o en locación) **no** está incluida en el abono mensual y constituye un servicio adicional, que se cotiza y abona por separado según se acuerde en cada caso.",
  },
  {
    key: "propiedad",
    titulo: "Propiedad intelectual y uso de materiales",
    default:
      "El Cliente es propietario de los materiales una vez abonados los honorarios. La Agencia podrá utilizar piezas y resultados en su portfolio o material de difusión, salvo objeción expresa por escrito del Cliente.",
  },
  {
    key: "canales",
    titulo: "Canales de comunicación oficiales",
    default:
      "La coordinación oficial del proyecto se realizará por el grupo de WhatsApp creado por La Agencia y/o el correo electrónico de contacto. Mensajes recibidos por otras vías (DM de redes sociales, llamadas no agendadas) podrán no ser atendidos en tiempo y forma.",
  },
  {
    key: "confidencialidad",
    titulo: "Confidencialidad",
    default:
      "Ninguna parte podrá divulgar información sensible obtenida en el marco de este acuerdo sin autorización previa de la otra.",
  },
  {
    key: "limitacion",
    titulo: "Limitación de responsabilidad",
    default:
      "La Agencia se compromete a aplicar las mejores prácticas y conocimientos en marketing digital, pero no puede garantizar resultados específicos (ventas, leads, alcance, etc.), ya que éstos dependen de múltiples factores externos.\n\nLa Agencia no será responsable por caídas, cambios de políticas o bloqueos de plataformas de terceros (Meta, Google, etc.).",
  },
  {
    key: "rescision",
    titulo: "Rescisión",
    default:
      "Cualquiera de las partes puede rescindir el presente acuerdo con aviso por escrito de 15 días. En caso de incumplimiento grave, incluyendo la falta de pago, La Agencia podrá rescindir el contrato de manera inmediata.",
  },
];

export type ContractClauseOverrides = Record<string, string>;

/** Override no vacío para una clave, o null si no hay. */
export function clauseOverride(
  overrides: ContractClauseOverrides | null | undefined,
  key: string
): string | null {
  const v = overrides?.[key];
  return v && v.trim() ? v : null;
}

/**
 * Renderiza el cuerpo de una cláusula editada: párrafos (separados por línea en
 * blanco) con soporte de **negrita**. Devuelve nodos <p> para usar dentro de
 * `section.clause`, respetando el estilo del documento.
 */
export function renderClauseBody(text: string): ReactNode {
  const paras = text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
  return createElement(
    Fragment,
    null,
    ...paras.map((p, i) => createElement("p", { key: i }, renderBold(p)))
  );
}

/** Parte un texto en nodos, convirtiendo **negrita** en <strong>. */
function renderBold(text: string): ReactNode[] {
  const parts = text.split(/\*\*/);
  return parts.map((part, i) =>
    i % 2 === 1
      ? createElement("strong", { key: i }, part)
      : createElement(Fragment, { key: i }, part)
  );
}
