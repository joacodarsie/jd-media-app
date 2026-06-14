import { SectionTabs } from "@/components/section-tabs";
import { coordinacionTabs } from "@/lib/section-tabs";

export default function CoordinacionLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div>
      <SectionTabs tabs={coordinacionTabs} />
      {children}
    </div>
  );
}
