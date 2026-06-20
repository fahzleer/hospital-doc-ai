import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const client = postgres(
  Bun.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5433/hospital_erp",
  { max: 1 },
);

await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
console.log("✅ Migration complete");
await client.end();
