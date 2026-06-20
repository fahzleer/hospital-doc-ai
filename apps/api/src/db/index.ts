import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

const client = postgres(
  Bun.env.DATABASE_URL ?? "postgresql://postgres:pass@localhost:5433/hospital_erp",
);

export const db = drizzle(client, { schema });
export { schema };
