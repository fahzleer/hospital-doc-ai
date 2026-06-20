import { type PostgresJsDatabase, drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

type Schema = typeof schema;

function createDb(): PostgresJsDatabase<Schema> {
  const databaseUrl = Bun.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error(
      "Missing DATABASE_URL environment variable. Set it in your Vercel project settings.",
    );
  }

  const client = postgres(databaseUrl);
  return drizzle(client, { schema });
}

let dbInstance: PostgresJsDatabase<Schema> | undefined;

export const db = new Proxy({} as PostgresJsDatabase<Schema>, {
  get(_target, prop) {
    if (!dbInstance) {
      dbInstance = createDb();
    }
    // biome-ignore lint/suspicious/noExplicitAny: proxy passthrough
    return (dbInstance as any)[prop];
  },
});

export { schema };
