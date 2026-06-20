import { sql } from "drizzle-orm";
import { db } from "../db";
import { documentCounters, documents } from "../db/schema";
import type { EntityType } from "../db/schema";

const PREFIX: Record<EntityType, string> = {
  work_order: "WO",
  contract: "CT",
  issue_note: "ISS",
};

const MAX_SEQ = 9999;

function currentYearBe(): number {
  return new Date().getFullYear() + 543;
}

function formatCode(prefix: string, yearBe: number, seq: number): string {
  return `${prefix}-${yearBe}-${String(seq).padStart(4, "0")}`;
}

export async function issueCode(entityType: EntityType, description?: string): Promise<string> {
  const yearBe = currentYearBe();
  const prefix = PREFIX[entityType];

  return db.transaction(async (tx) => {
    const rows = await tx
      .insert(documentCounters)
      .values({ entityType, yearBe, seq: 1 })
      .onConflictDoUpdate({
        target: [documentCounters.entityType, documentCounters.yearBe],
        set: { seq: sql`${documentCounters.seq} + 1` },
      })
      .returning({ seq: documentCounters.seq });

    const seq = rows[0]?.seq;
    if (seq === undefined) throw new Error("Counter UPSERT returned no seq");

    if (seq > MAX_SEQ) {
      throw new Error(
        `Sequence overflow: ${entityType} year ${yearBe} has reached the ${MAX_SEQ} document limit`,
      );
    }

    const code = formatCode(prefix, yearBe, seq);

    const inserted = await tx
      .insert(documents)
      .values({ entityType, code, ...(description ? { description } : {}) })
      .returning({ code: documents.code });

    const doc = inserted[0];
    if (!doc) throw new Error("INSERT documents returned no row");

    return doc.code;
  });
}
