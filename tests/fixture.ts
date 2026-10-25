import path from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "@/lib/db/schema";
import { seedDatabase } from "@/lib/db/seed";
import type { Snapshot } from "@/lib/domain/plant";

export const NOW = Date.UTC(2026, 9, 26, 13, 0, 0);

/** Fresh in-memory database, migrated with the real SQL migrations and seeded with the demo plant. */
export async function seededSnapshot(): Promise<Snapshot> {
  const client = createClient({ url: ":memory:" });
  const db = drizzle(client, { schema });
  await migrate(db, { migrationsFolder: path.join(__dirname, "..", "drizzle") });
  await seedDatabase(db, NOW);
  const s = schema;
  return {
    now: NOW,
    items: await db.select().from(s.items),
    suppliers: await db.select().from(s.suppliers),
    purchaseOrders: await db.select().from(s.purchaseOrders),
    poLines: await db.select().from(s.poLines),
    customers: await db.select().from(s.customers),
    salesOrders: await db.select().from(s.salesOrders),
    soLines: await db.select().from(s.soLines),
    workOrders: await db.select().from(s.workOrders),
    assets: await db.select().from(s.assets),
  };
}
