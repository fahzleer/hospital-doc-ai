import { inArray } from "drizzle-orm";
import { issueCode } from "../services/issueCode";
import { db } from "./index";
import { documentCounters, documents } from "./schema";

async function seed() {
  console.log("🗑️  Clearing existing data...");
  await db.delete(documents);
  await db.delete(documentCounters);

  console.log("🌱 Issuing document codes...");

  const wo = await Promise.all([
    issueCode("work_order"),
    issueCode("work_order"),
    issueCode("work_order"),
    issueCode("work_order"),
    issueCode("work_order"),
  ]);

  const ct = await Promise.all([
    issueCode("contract"),
    issueCode("contract"),
    issueCode("contract"),
    issueCode("contract"),
  ]);

  const iss = await Promise.all([
    issueCode("issue_note"),
    issueCode("issue_note"),
    issueCode("issue_note"),
    issueCode("issue_note"),
  ]);

  const toSoftDelete = [wo[3], wo[4], ct[3], iss[3]];

  await db
    .update(documents)
    .set({ deletedAt: new Date() })
    .where(inArray(documents.code, toSoftDelete));

  const activeCount = wo.length + ct.length + iss.length - toSoftDelete.length;
  console.log(
    `✅ Seeded ${wo.length + ct.length + iss.length} documents` +
      ` — ${activeCount} active, ${toSoftDelete.length} soft-deleted`,
  );
  console.log("\nActive codes:");
  console.log(" WO:", wo.slice(0, 3).join(", "));
  console.log(" CT:", ct.slice(0, 3).join(", "));
  console.log("ISS:", iss.slice(0, 3).join(", "));
  console.log("\nSoft-deleted:", toSoftDelete.join(", "));
}

seed()
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  })
  .finally(() => process.exit(0));
