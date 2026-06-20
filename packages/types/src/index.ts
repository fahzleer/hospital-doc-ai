import { scope } from "arktype";

export const ENTITY_TYPES = ["work_order", "contract", "issue_note"] as const;
export type EntityType = (typeof ENTITY_TYPES)[number];

const s = scope({
  entityType: "'work_order' | 'contract' | 'issue_note'",
  createDocument: {
    entityType: "entityType",
    "description?": "string",
  },
  listDocumentsQuery: {
    "entityType?": "entityType",
    "search?": "string",
    "page?": "number.integer >= 1",
    "pageSize?": "1 <= number.integer <= 100",
  },
  classifyResult: {
    entityType: "entityType",
    "confidence?": "0 <= number <= 1",
  },
  document: {
    id: "string.uuid",
    entityType: "entityType",
    code: "string",
    "description?": "string | null",
    createdAt: "string",
  },
  listDocumentsResponse: {
    rows: "document[]",
    total: "number.integer >= 0",
    page: "number.integer >= 1",
    pageSize: "number.integer >= 1",
  },
  classifyRequest: {
    text: "string > 0",
  },
  classifyResponse: {
    entityType: "entityType",
    "confidence?": "0 <= number <= 1",
    code: "string",
  },
}).export();

export const entityTypeSchema = s.entityType;
export const createDocumentSchema = s.createDocument;
export type CreateDocumentInput = typeof createDocumentSchema.infer;

export const listDocumentsQuerySchema = s.listDocumentsQuery;
export type ListDocumentsQuery = typeof listDocumentsQuerySchema.infer;

export const classifyResultSchema = s.classifyResult;
export type ClassifyResult = typeof classifyResultSchema.infer;

export const documentSchema = s.document;
export type DocumentRow = typeof documentSchema.infer;

export const listDocumentsResponseSchema = s.listDocumentsResponse;
export type ListDocumentsResponse = typeof listDocumentsResponseSchema.infer;

export const classifyRequestSchema = s.classifyRequest;
export type ClassifyRequest = typeof classifyRequestSchema.infer;

export const classifyResponseSchema = s.classifyResponse;
export type ClassifyResponse = typeof classifyResponseSchema.infer;
