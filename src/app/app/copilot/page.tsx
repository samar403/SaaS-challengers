import { Suspense } from "react";
import { TitleBlock } from "@/components/ui";
import { CopilotChat } from "@/components/plant/copilot-chat";

export const metadata = { title: "Copilot" };

export default function CopilotPage() {
  return (
    <>
      <TitleBlock
        sheet="08"
        title="Copilot"
        subtitle="Natural-language access to the whole plant, grounded in live data. It cites WO, PO and SKU numbers so you can act on every answer."
        cells={[
          { k: "Tools", v: "8 read · 2 draft" },
          { k: "Writes", v: "Via approval only" },
        ]}
      />
      <Suspense fallback={<div className="sheet hatch min-h-[60vh] animate-pulse" />}>
        <CopilotChat />
      </Suspense>
    </>
  );
}
