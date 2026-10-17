"use server";

import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { updateTag } from "next/cache";
import type { JSONContent } from "@tiptap/react";
import { db, documents, nodes, type NodeType } from "@/db";
import { requireSession } from "@/lib/auth";
import { DOCUMENTS_TAG, documentTag } from "@/lib/queries";
import { slugify, uniqueSlug } from "@/lib/slug";

const DEFAULT_TITLE: Record<NodeType, string> = {
  section: "Capítulo sin título",
  article: "Artículo sin título",
  clause: "Inciso sin título",
};

async function touch(documentSlug: string) {
  await db
    .update(documents)
    .set({ updatedAt: new Date() })
    .where(eq(documents.slug, documentSlug));
  updateTag(documentTag(documentSlug));
  updateTag(DOCUMENTS_TAG);
}

async function takenSlugs(documentSlug: string) {
  const rows = await db
    .select({ slug: nodes.slug })
    .from(nodes)
    .where(eq(nodes.documentSlug, documentSlug));
  return new Set(rows.map((r) => r.slug));
}

export async function createNode(input: {
  documentSlug: string;
  parentId: string | null;
  type: NodeType;
}): Promise<string> {
  await requireSession();
  const { documentSlug, parentId, type } = input;

  const siblingScope = and(
    eq(nodes.documentSlug, documentSlug),
    parentId ? eq(nodes.parentId, parentId) : isNull(nodes.parentId),
  );

  const [{ next } = { next: 0 }] = await db
    .select({ next: sql<number>`coalesce(max(${nodes.position}), -1) + 1` })
    .from(nodes)
    .where(siblingScope);

  // El hermano anterior del mismo tipo marca la convención: si los principios
  // van en romanos, el siguiente también, sin reconfigurar nada.
  const [previous] = await db
    .select({ label: nodes.label, numberFormat: nodes.numberFormat })
    .from(nodes)
    .where(and(siblingScope, eq(nodes.type, type)))
    .orderBy(desc(nodes.position))
    .limit(1);

  const title = DEFAULT_TITLE[type];
  const slug = uniqueSlug(slugify(title), await takenSlugs(documentSlug));

  const [row] = await db
    .insert(nodes)
    .values({
      documentSlug,
      parentId,
      type,
      position: next,
      title,
      slug,
      numberFormat: previous?.numberFormat ?? null,
      // Si el anterior va sin rótulo, el nuevo también.
      label: previous?.label === "" ? "" : null,
    })
    .returning({ id: nodes.id });

  await touch(documentSlug);
  return row.id;
}

export async function updateNode(input: {
  id: string;
  title?: string;
  label?: string | null;
  numberFormat?: string | null;
  body?: JSONContent | null;
}): Promise<void> {
  await requireSession();

  const [current] = await db
    .select()
    .from(nodes)
    .where(eq(nodes.id, input.id))
    .limit(1);
  if (!current) throw new Error("Ese apartado ya no existe.");

  const patch: Partial<typeof nodes.$inferInsert> = { updatedAt: new Date() };

  if (input.title !== undefined) {
    const title = input.title.trim();
    patch.title = title;
    // El ancla sigue al título solo mientras nadie haya citado el documento;
    // en cuanto cambia, el enlace viejo deja de resolver. Por eso solo se
    // regenera si el título tenía el valor por defecto.
    if (current.title === DEFAULT_TITLE[current.type] && title) {
      const taken = await takenSlugs(current.documentSlug);
      taken.delete(current.slug);
      patch.slug = uniqueSlug(slugify(title), taken);
    }
  }
  if (input.label !== undefined) {
    // Cadena vacía es un estado real —«sin rótulo»—, no un campo en blanco.
    patch.label = input.label === null ? null : input.label.trim();
  }
  if (input.numberFormat !== undefined) {
    patch.numberFormat = input.numberFormat?.trim() || null;
  }
  if (input.body !== undefined) patch.body = input.body;

  await db.update(nodes).set(patch).where(eq(nodes.id, input.id));
  await touch(current.documentSlug);
}

export async function deleteNode(id: string): Promise<void> {
  await requireSession();
  const [row] = await db
    .select({ documentSlug: nodes.documentSlug })
    .from(nodes)
    .where(eq(nodes.id, id))
    .limit(1);
  if (!row) return;

  // Los hijos caen con el padre (onDelete: cascade en el schema).
  await db.delete(nodes).where(eq(nodes.id, id));
  await touch(row.documentSlug);
}

/** Intercambia el nodo con su hermano anterior o siguiente. */
export async function moveNode(
  id: string,
  direction: "up" | "down",
): Promise<void> {
  await requireSession();

  const [node] = await db.select().from(nodes).where(eq(nodes.id, id)).limit(1);
  if (!node) return;

  const siblings = await db
    .select({ id: nodes.id, position: nodes.position })
    .from(nodes)
    .where(
      and(
        eq(nodes.documentSlug, node.documentSlug),
        node.parentId ? eq(nodes.parentId, node.parentId) : isNull(nodes.parentId),
      ),
    )
    .orderBy(asc(nodes.position));

  const index = siblings.findIndex((s) => s.id === id);
  const target = siblings[direction === "up" ? index - 1 : index + 1];
  if (!target) return;

  await db
    .update(nodes)
    .set({ position: target.position })
    .where(eq(nodes.id, node.id));
  await db
    .update(nodes)
    .set({ position: node.position })
    .where(eq(nodes.id, target.id));

  await touch(node.documentSlug);
}
