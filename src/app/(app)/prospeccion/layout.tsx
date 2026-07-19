import { SectionTabs } from "@/components/section-tabs";
import { comercialTabs } from "@/lib/section-tabs";

export default function ProspeccionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <SectionTabs tabs={comercialTabs} />
      {children}
    </div>
  );
}
