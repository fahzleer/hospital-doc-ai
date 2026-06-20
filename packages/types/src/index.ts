import { type } from "arktype";

export const ENTITY_TYPES = ["work_order", "contract", "issue_note"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

export const entityTypeSchema = type.enumerated(...ENTITY_TYPES);

export const createDocumentSchema = type({
  entityType: entityTypeSchema,
  "description?": "string",
});

export type CreateDocumentInput = typeof createDocumentSchema.infer;

export const listDocumentsQuerySchema = type({
  "entityType?": entityTypeSchema,
  "search?": "string",
  "page?": "number.integer >= 1",
  "pageSize?": "1 <= number.integer <= 100",
});

export type ListDocumentsQuery = typeof listDocumentsQuerySchema.infer;

export const classifyResultSchema = type({
  entityType: entityTypeSchema,
  "confidence?": "0 <= number <= 1",
});

export type ClassifyResult = typeof classifyResultSchema.infer;

export const documentSchema = type({
  id: "string.uuid",
  entityType: entityTypeSchema,
  code: "string",
  "description?": "string | null",
  createdAt: "string",
});

export type DocumentRow = typeof documentSchema.infer;

export const listDocumentsResponseSchema = type({
  rows: documentSchema.array(),
  total: "number.integer >= 0",
  page: "number.integer >= 1",
  pageSize: "number.integer >= 1",
});

export type ListDocumentsResponse = typeof listDocumentsResponseSchema.infer;

export const classifyRequestSchema = type({
  text: "string > 0",
});

export type ClassifyRequest = typeof classifyRequestSchema.infer;

export const classifyResponseSchema = type({
  entityType: entityTypeSchema,
  "confidence?": "0 <= number <= 1",
  code: "string",
});

export type ClassifyResponse = typeof classifyResponseSchema.infer;
