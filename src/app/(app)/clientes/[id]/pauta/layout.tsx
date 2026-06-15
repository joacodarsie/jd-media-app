import { SectionTabs } from "@/components/section-tabs";

export default function PublicidadLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const tabs = [
    { href: `/clientes/${params.id}/pauta`, label: "Setup" },
    { href: `/clientes/${params.id}/pauta/analisis`, label: "Análisis & IA" },
  ];
  return (
    <div>
      <SectionTabs tabs={tabs} />
      {children}
    </div>
  );
}
