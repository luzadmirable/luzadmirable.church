import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import type { JSONContent } from "@tiptap/react";

/** Un documento normativo: membresía, bases doctrinales. */
export const documents = pgTable("documents", {
  slug: text("slug").primaryKey(),
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  /** Autoría y fecha. Un tratado lleva firma; un estatuto no. */
  byline: text("byline"),
  position: integer("position").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/**
 * section → capítulo o apartado
 * article → artículo
 * clause  → inciso dentro de un artículo
 */
export const nodeType = pgEnum("node_type", ["section", "article", "clause"]);

/**
 * Árbol del documento en una sola tabla autorreferenciada. La profundidad es
 * libre: un apartado puede contener sub-apartados, y un artículo incisos.
 */
export const nodes = pgTable(
  "nodes",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentSlug: text("document_slug")
      .notNull()
      .references(() => documents.slug, { onDelete: "cascade" }),
    parentId: uuid("parent_id").references((): AnyPgColumn => nodes.id, {
      onDelete: "cascade",
    }),
    type: nodeType("type").notNull().default("article"),
    /** Orden entre hermanos. */
    position: integer("position").notNull().default(0),
    /**
     * Rótulo del nodo, con tres estados:
     *   null  → derivarlo con `numberFormat`
     *   ""    → sin rótulo (apartados que en el original no llevan número)
     *   texto → literal, gana sobre todo
     */
    label: text("label"),
    /**
     * Plantilla de numeración automática. Fichas: {n} arábigo, {R} romano,
     * {a} letra. Ejemplos: "Capítulo {R}", "Artículo {n}", "{R}.", "{a})".
     * Si va en null se usa la convención por defecto del tipo.
     */
    numberFormat: text("number_format"),
    title: text("title").notNull().default(""),
    /** Ancla estable para citar: /membresia#articulo-7-admision */
    slug: text("slug").notNull(),
    body: jsonb("body").$type<JSONContent | null>(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("nodes_order_idx").on(t.documentSlug, t.parentId, t.position),
    unique("nodes_slug_unique").on(t.documentSlug, t.slug),
  ],
);

export type DocumentRow = typeof documents.$inferSelect;
export type NodeRow = typeof nodes.$inferSelect;
export type NodeType = (typeof nodeType.enumValues)[number];
