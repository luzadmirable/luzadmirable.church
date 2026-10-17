"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, documents, type NodeType } from "@/db";
import { requireSession } from "@/lib/auth";
import { DOCUMENTS_TAG, documentTag } from "@/lib/queries";
import { updateTag } from "next/cache";
import { createNode, deleteNode, moveNode } from "./nodes";

/** Envoltorios para usarse directo en <form action={...}>. */

export async function createNodeForm(formData: FormData): Promise<void> {
  const documentSlug = String(formData.get("documentSlug"));
  const parentRaw = String(formData.get("parentId") ?? "");
  const type = String(formData.get("type")) as NodeType;

  const id = await createNode({
    documentSlug,
    parentId: parentRaw || null,
    type,
  });
  redirect(`/admin/${documentSlug}?nodo=${id}`);
}

export async function moveNodeForm(formData: FormData): Promise<void> {
  await moveNode(
    String(formData.get("id")),
    String(formData.get("direction")) === "up" ? "up" : "down",
  );
}

export async function deleteNodeForm(formData: FormData): Promise<void> {
  const documentSlug = String(formData.get("documentSlug"));
  await deleteNode(String(formData.get("id")));
  redirect(`/admin/${documentSlug}`);
}

export async function updateDocumentForm(formData: FormData): Promise<void> {
  await requireSession();
  const slug = String(formData.get("slug"));
  const title = String(formData.get("title") ?? "").trim();
  const subtitle = String(formData.get("subtitle") ?? "").trim();
  const byline = String(formData.get("byline") ?? "").trim();

  if (!title) return;

  await db
    .update(documents)
    .set({
      title,
      subtitle: subtitle || null,
      byline: byline || null,
      updatedAt: new Date(),
    })
    .where(eq(documents.slug, slug));

  updateTag(documentTag(slug));
  updateTag(DOCUMENTS_TAG);
}
