CREATE TYPE "public"."node_type" AS ENUM('section', 'article', 'clause');--> statement-breakpoint
CREATE TABLE "documents" (
	"slug" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"subtitle" text,
	"position" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nodes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_slug" text NOT NULL,
	"parent_id" uuid,
	"type" "node_type" DEFAULT 'article' NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"label" text,
	"title" text DEFAULT '' NOT NULL,
	"slug" text NOT NULL,
	"body" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nodes_slug_unique" UNIQUE("document_slug","slug")
);
--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_document_slug_documents_slug_fk" FOREIGN KEY ("document_slug") REFERENCES "public"."documents"("slug") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nodes" ADD CONSTRAINT "nodes_parent_id_nodes_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."nodes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "nodes_order_idx" ON "nodes" USING btree ("document_slug","parent_id","position");