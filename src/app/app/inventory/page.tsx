import { Suspense } from "react";
import { getSnapshot } from "@/lib/db/queries";
import { stockPositions } from "@/lib/domain/plant";
import { SkeletonRows, TitleBlock } from "@/components/ui";
import { InventoryTable, type InventoryRow } from "@/components/plant/inventory-table";

export const metadata = { title: "Inventory" };

export default function InventoryPage() {
  return (
    <>
      <TitleBlock
        sheet="03"
        title="Inventory"
        subtitle="Stock positions net of allocations and inbound POs. Thresholds flex with each supplier's real lead time."
        cells={[
          { k: "Valuation", v: "Standard cost" },
          { k: "Locations", v: "WH-A/B/C · CRIB · FG" },
        ]}
      />
      <Suspense fallback={<SkeletonRows rows={10} />}>
        <Inventory />
      </Suspense>
    </>
  );
}

async function Inventory() {
  const s = await getSnapshot();
  const rows: InventoryRow[] = stockPositions(s).map((p) => ({
    id: p.item.id,
    sku: p.item.sku,
    name: p.item.name,
    category: p.item.category,
    uom: p.item.uom,
    location: p.item.location,
    onHand: p.item.onHand,
    available: p.available,
    inbound: p.inbound,
    reorderPoint: p.item.reorderPoint,
    daysOfCover: Number.isFinite(p.daysOfCover) ? p.daysOfCover : null,
    health: p.health,
    value: p.item.onHand * p.item.unitCost,
    supplier: s.suppliers.find((x) => x.id === p.item.supplierId)?.code ?? "—",
    legacyRef: p.item.legacyRef,
  }));
  return <InventoryTable rows={rows} />;
}
