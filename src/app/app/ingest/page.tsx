import { TitleBlock } from "@/components/ui";
import { IngestWorkbench } from "@/components/plant/ingest-workbench";

export const metadata = { title: "Ingest" };

export default function IngestPage() {
  return (
    <>
      <TitleBlock
        sheet="09"
        title="Ingest"
        subtitle="The clerical layer, automated. Invoices, acknowledgements and customer emails become structured, matched, checked records — with a human commit."
        cells={[
          { k: "Formats", v: "PDF · image · text" },
          { k: "Checks", v: "3-way match" },
        ]}
      />
      <IngestWorkbench />
    </>
  );
}
