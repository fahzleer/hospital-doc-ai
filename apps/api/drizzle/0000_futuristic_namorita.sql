CREATE TYPE "public"."entity_type" AS ENUM('work_order', 'contract', 'issue_note');--> statement-breakpoint
CREATE TABLE "document_counters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"year_be" integer NOT NULL,
	"seq" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "document_counters_entity_type_year_be_uniq" UNIQUE("entity_type","year_be")
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_type" "entity_type" NOT NULL,
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "documents_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE INDEX "documents_entity_type_deleted_at_idx" ON "documents" USING btree ("entity_type","deleted_at");