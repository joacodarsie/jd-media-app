import { SectionTabs } from "@/components/section-tabs";

export default function PublicidadLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { id: string };
}) {
  const tabs = [
    { href: `/clientes/${params.id}/publicidad`, label: "Setup" },
    { href: `/clientes/${params.id}/publicidad/analisis`, label: "Análisis & IA" },
  ];
  return (
    <div>
      <SectionTabs tabs={tabs} />
      {children}
    </div>
  );
}
