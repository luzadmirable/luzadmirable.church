import "server-only";
import { asc, eq } from "drizzle-orm";
import { cacheTag } from "next/cache";
import { db, documents, nodes } from "@/db";
import { buildTree } from "./tree";

/**
 * Las lecturas van cacheadas y etiquetadas: el documento público se sirve sin
 * tocar la base de datos, y al guardar en el panel se invalida solo su
 * etiqueta. Así el texto se actualiza al instante sin reconstruir el sitio.
 */

export const DOCUMENTS_TAG = "documents";
export const documentTag = (slug: string) => `document:${slug}`;

export async function listDocuments() {
  "use cache";
  cacheTag(DOCUMENTS_TAG);
  return db.select().from(documents).orderBy(asc(documents.position));
}

export async function getDocument(slug: string) {
  "use cache";
  cacheTag(documentTag(slug));
  const [row] = await db
    .select()
    .from(documents)
    .where(eq(documents.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function getDocumentTree(slug: string) {
  "use cache";
  cacheTag(documentTag(slug));
  const rows = await db
    .select()
    .from(nodes)
    .where(eq(nodes.documentSlug, slug))
    .orderBy(asc(nodes.position));
  return buildTree(rows);
}
