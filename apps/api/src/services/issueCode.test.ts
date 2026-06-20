import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { and, eq, like } from "drizzle-orm";
import { db } from "../db";
import { documentCounters, documents } from "../db/schema";
import { issueCode } from "./issueCode";

const YEAR_BE = new Date().getFullYear() + 543;

async function cleanWo() {
  await db.delete(documents).where(like(documents.code, `WO-${YEAR_BE}-%`));
  await db
    .delete(documentCounters)
    .where(
      and(eq(documentCounters.entityType, "work_order"), eq(documentCounters.yearBe, YEAR_BE)),
    );
}

beforeEach(cleanWo);
afterEach(cleanWo);

describe("issueCode", () => {
  test("concurrent 10 requests → no duplicate codes", async () => {
    const codes = await Promise.all(Array.from({ length: 10 }, () => issueCode("work_order")));

    expect(new Set(codes).size).toBe(10);

    for (const code of codes) {
      expect(code).toMatch(/^WO-\d{4}-\d{4}$/);
    }

    const seqs = codes.map((c) => Number(c.split("-")[2])).sort((a, b) => a - b);

    expect(seqs).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  test("code format is valid — prefix, Buddhist year, 4-digit sequence", async () => {
    const code = await issueCode("work_order");
    const [prefix, year, seq] = code.split("-");

    expect(prefix).toBe("WO");
    expect(Number(year)).toBe(YEAR_BE);
    expect(seq).toHaveLength(4);
    expect(Number(seq)).toBeGreaterThanOrEqual(1);
  });

  test("each entityType has its own counter", async () => {
    await db.delete(documents).where(like(documents.code, `CT-${YEAR_BE}-%`));
    await db
      .delete(documentCounters)
      .where(
        and(eq(documentCounters.entityType, "contract"), eq(documentCounters.yearBe, YEAR_BE)),
      );

    const [wo, ct] = await Promise.all([issueCode("work_order"), issueCode("contract")]);

    expect(wo).toBe(`WO-${YEAR_BE}-0001`);
    expect(ct).toBe(`CT-${YEAR_BE}-0001`);

    await db.delete(documents).where(like(documents.code, `CT-${YEAR_BE}-%`));
    await db
      .delete(documentCounters)
      .where(
        and(eq(documentCounters.entityType, "contract"), eq(documentCounters.yearBe, YEAR_BE)),
      );
  });
});
