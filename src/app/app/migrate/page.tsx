import { TitleBlock } from "@/components/ui";
import { MigrateWorkbench } from "@/components/plant/migrate-workbench";

export const metadata = { title: "Migrate" };

export default function MigratePage() {
  return (
    <>
      <TitleBlock
        sheet="10"
        title="Migrate"
        subtitle="The wedge. Drop the export your old ERP already produces; Lathe maps cryptic legacy fields, fixes formats, rejects bad rows and loads the item master — in minutes, not a consulting quarter."
        cells={[
          { k: "Sources", v: "SAP · Oracle · Epicor · Infor · Sage" },
          { k: "Re-runnable", v: "Upsert by SKU" },
        ]}
      />
      <MigrateWorkbench />
    </>
  );
}
