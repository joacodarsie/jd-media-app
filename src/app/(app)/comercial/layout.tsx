import { SectionTabs } from "@/components/section-tabs";
import { comercialTabs } from "@/lib/section-tabs";

export default function ComercialLayout({
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
