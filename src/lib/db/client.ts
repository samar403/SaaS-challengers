import "server-only";
import fs from "node:fs";
import path from "node:path";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import * as schema from "./schema";
import { seedDatabase } from "./seed";

export type DB = LibSQLDatabase<typeof schema>;

type Holder = { client: Client; db: DB; ready: Promise<void> };

// Survive dev-server hot reloads without opening a new connection per edit.
const globalForDb = globalThis as unknown as { __latheDb?: Holder };

function open(): Holder {
  const url = process.env.DATABASE_URL ?? "file:./data/lathe.db";
  if (url.startsWith("file:")) {
    const file = url.slice("file:".length);
    fs.mkdirSync(path.dirname(path.resolve(file)), { recursive: true });
  }
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  const db = drizzle(client, { schema });
  const ready = (async () => {
    if (url.startsWith("file:")) await client.execute("PRAGMA foreign_keys = ON");
    await migrate(db, { migrationsFolder: path.join(process.cwd(), "drizzle") });
    const [{ count }] = (await client.execute("SELECT COUNT(*) AS count FROM items")).rows as unknown as {
      count: number;
    }[];
    if (Number(count) === 0) await seedDatabase(db);
  })();
  return { client, db, ready };
}

/** Returns a migrated, seeded database handle. */
export async function getDb(): Promise<DB> {
  globalForDb.__latheDb ??= open();
  await globalForDb.__latheDb.ready;
  return globalForDb.__latheDb.db;
}
