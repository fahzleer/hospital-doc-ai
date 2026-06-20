import {
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

export const entityTypeEnum = pgEnum("entity_type", ["work_order", "contract", "issue_note"]);

export type EntityType = (typeof entityTypeEnum.enumValues)[number];

export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: entityTypeEnum("entity_type").notNull(),
    code: text("code").notNull().unique(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    description: text("description"),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (t) => [index("documents_entity_type_deleted_at_idx").on(t.entityType, t.deletedAt)],
);

export const documentCounters = pgTable(
  "document_counters",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    entityType: entityTypeEnum("entity_type").notNull(),
    yearBe: integer("year_be").notNull(),
    seq: integer("seq").notNull().default(0),
  },
  (t) => [unique("document_counters_entity_type_year_be_uniq").on(t.entityType, t.yearBe)],
);
