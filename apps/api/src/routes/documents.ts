import { classifyRequestSchema, createDocumentSchema, listDocumentsQuerySchema } from "@app/types";
import { type } from "arktype";
import { and, count, desc, eq, ilike, isNull } from "drizzle-orm";
import { Elysia } from "elysia";
import { db } from "../db";
import { documents } from "../db/schema";
import { classifyDocument } from "../services/classifyDocument";
import { issueCode } from "../services/issueCode";

export const documentsRoute = new Elysia({ prefix: "/documents" })

  .get("/", async ({ query, set }) => {
    const rawQuery: Record<string, unknown> = {};
    if (query.entityType !== undefined) rawQuery.entityType = query.entityType;
    if (query.search !== undefined) rawQuery.search = query.search;
    if (query.page !== undefined) rawQuery.page = Number(query.page);
    if (query.pageSize !== undefined) rawQuery.pageSize = Number(query.pageSize);

    const parsed = listDocumentsQuerySchema(rawQuery);
    if (parsed instanceof type.errors) {
      set.status = 422;
      return { error: parsed.summary };
    }

    const page = parsed.page ?? 1;
    const pageSize = parsed.pageSize ?? 20;
    const offset = (page - 1) * pageSize;

    const conditions = [isNull(documents.deletedAt)];

    if (parsed.entityType) {
      conditions.push(eq(documents.entityType, parsed.entityType));
    }
    if (parsed.search) {
      conditions.push(ilike(documents.code, `%${parsed.search}%`));
    }

    const where = and(...conditions);

    const { total, rows } = await db.transaction(async (tx) => {
      const countRows = await tx.select({ total: count() }).from(documents).where(where);
      const total = countRows[0]?.total ?? 0;

      const rows = await tx
        .select({
          id: documents.id,
          entityType: documents.entityType,
          code: documents.code,
          description: documents.description,
          createdAt: documents.createdAt,
        })
        .from(documents)
        .where(where)
        .orderBy(desc(documents.createdAt))
        .limit(pageSize)
        .offset(offset);

      return { total, rows };
    });

    return { rows, total, page, pageSize };
  })

  .post("/", async ({ body, set }) => {
    const parsed = createDocumentSchema(body);
    if (parsed instanceof type.errors) {
      set.status = 422;
      return { error: parsed.summary };
    }

    let code: string;
    try {
      code = await issueCode(parsed.entityType, parsed.description);
    } catch (err) {
      set.status = 500;
      return { error: err instanceof Error ? err.message : "issueCode failed" };
    }

    const rows = await db
      .select({
        id: documents.id,
        entityType: documents.entityType,
        code: documents.code,
        description: documents.description,
        createdAt: documents.createdAt,
      })
      .from(documents)
      .where(eq(documents.code, code))
      .limit(1);

    const doc = rows[0];
    if (!doc) {
      set.status = 500;
      return { error: "document created but could not be retrieved" };
    }

    set.status = 201;
    return doc;
  })

  .post("/classify", async ({ body, set }) => {
    const parsed = classifyRequestSchema(body);
    if (parsed instanceof type.errors) {
      set.status = 422;
      return { error: parsed.summary };
    }

    let result: Awaited<ReturnType<typeof classifyDocument>> | null = null;
    try {
      result = await classifyDocument(parsed.text);
    } catch (err) {
      if (!(err instanceof Error && err.message === "cannot_classify")) {
        set.status = 500;
        return { error: err instanceof Error ? err.message : "classify failed" };
      }
    }

    if (!result) {
      set.status = 200;
      return { entityType: "unknown" as const, code: null };
    }

    let code: string;
    try {
      code = await issueCode(result.entityType, parsed.text);
    } catch (err) {
      set.status = 500;
      return { error: err instanceof Error ? err.message : "issueCode failed" };
    }

    set.status = 201;
    return {
      entityType: result.entityType,
      ...(result.confidence !== undefined && { confidence: result.confidence }),
      code,
    };
  });
