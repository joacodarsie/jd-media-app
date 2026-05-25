// Reusa el detalle de agencia/[slug] (mismo contenido, distinto breadcrumb)
import AgencyPageDetail from "@/app/(app)/agencia/[slug]/page";

export const revalidate = 60;

export default function ProcessDetail({ params }: { params: { slug: string } }) {
  return AgencyPageDetail({ params });
}
