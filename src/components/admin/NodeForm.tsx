"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import type { JSONContent } from "@tiptap/react";
import { deleteNodeForm } from "@/actions/forms";
import { updateNode } from "@/actions/nodes";
import { BodyEditor } from "./BodyEditor";
import { ConfirmButton } from "./ConfirmButton";

const TYPE_NAME = {
  section: "Capítulo",
  article: "Artículo",
  clause: "Inciso",
} as const;

export type EditableNode = {
  id: string;
  type: keyof typeof TYPE_NAME;
  title: string;
  label: string | null;
  numberFormat: string | null;
  slug: string;
  body: JSONContent | null;
  resolvedLabel: string;
};

/** Plantillas frecuentes. {n} arábigo · {R} romano · {a} letra */
const FORMATS = [
  { value: "", name: "Por defecto del tipo" },
  { value: "Capítulo {R}", name: "Capítulo I, II, III…" },
  { value: "Artículo {n}", name: "Artículo 1, 2, 3…" },
  { value: "{R}.", name: "I. II. III. (sin palabra)" },
  { value: "{n}.", name: "1. 2. 3." },
  { value: "{a})", name: "a) b) c)" },
];

export function NodeForm({
  node,
  documentSlug,
}: {
  node: EditableNode;
  documentSlug: string;
}) {
  const [title, setTitle] = useState(node.title);
  const [label, setLabel] = useState(node.label ?? "");
  // `label === ""` en la base significa «sin rótulo»; null significa «auto».
  const [unlabeled, setUnlabeled] = useState(node.label === "");
  const [numberFormat, setNumberFormat] = useState(node.numberFormat ?? "");
  const [saving, startSaving] = useTransition();
  const [saved, setSaved] = useState(false);
  const bodyRef = useRef<JSONContent | null>(node.body);
  const dirtyRef = useRef(false);

  function save() {
    startSaving(async () => {
      await updateNode({
        id: node.id,
        title,
        label: unlabeled ? "" : label || null,
        numberFormat: numberFormat || null,
        body: bodyRef.current,
      });
      dirtyRef.current = false;
      setSaved(true);
    });
  }

  // ⌘S / Ctrl+S guarda, como en cualquier editor.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  });

  function markDirty() {
    dirtyRef.current = true;
    setSaved(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="label-util text-[0.68rem] text-accent">
          {TYPE_NAME[node.type]} · {node.resolvedLabel}
        </p>
        <p className="font-util text-xs text-ink-faint">
          Ancla: <code className="text-ink-soft">#{node.slug}</code>
        </p>
      </div>

      <Field label="Título">
        <input
          value={title}
          onChange={(event) => {
            setTitle(event.target.value);
            markDirty();
          }}
          placeholder="De la admisión de miembros"
          className="w-full border border-rule bg-surface px-3 py-2 font-body text-lg text-ink outline-none focus:border-accent"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
        <Field
          label="Numeración"
          hint={unlabeled ? "desactivada" : `ahora: ${node.resolvedLabel}`}
        >
          <select
            value={numberFormat}
            disabled={unlabeled}
            onChange={(event) => {
              setNumberFormat(event.target.value);
              markDirty();
            }}
            className="w-full border border-rule bg-surface px-3 py-2 font-util text-sm text-ink outline-none focus:border-accent disabled:opacity-40"
          >
            {FORMATS.map((f) => (
              <option key={f.value} value={f.value}>
                {f.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Rótulo manual" hint="sobrescribe la numeración">
          <input
            value={label}
            disabled={unlabeled}
            onChange={(event) => {
              setLabel(event.target.value);
              markDirty();
            }}
            placeholder="automático"
            className="w-full border border-rule bg-surface px-3 py-2 font-util text-sm text-ink outline-none focus:border-accent disabled:opacity-40"
          />
        </Field>
      </div>

      <label className="flex items-center gap-2.5 font-util text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={unlabeled}
          onChange={(event) => {
            setUnlabeled(event.target.checked);
            markDirty();
          }}
          className="size-4 accent-[var(--accent)]"
        />
        Sin rótulo — este apartado no lleva número ni etiqueta
      </label>

      <Field label="Texto">
        <BodyEditor
          key={node.id}
          value={node.body}
          onChange={(next) => {
            bodyRef.current = next;
            markDirty();
          }}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-4 border-t border-rule pt-5">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="label-util bg-accent px-4 py-2 text-[0.7rem] text-paper transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <p className="font-util text-xs text-ink-faint" role="status">
          {saved ? "Guardado. Ya está publicado en el documento." : "⌘S"}
        </p>

        <form action={deleteNodeForm} className="ml-auto">
          <input type="hidden" name="id" value={node.id} />
          <input type="hidden" name="documentSlug" value={documentSlug} />
          <ConfirmButton
            message={`¿Eliminar "${node.title || "(sin título)"}"? También se borra todo lo que contiene.`}
            className="label-util px-2 py-2 text-[0.68rem] text-danger transition-colors hover:bg-danger-soft"
          >
            Eliminar
          </ConfirmButton>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="label-util text-[0.66rem] text-ink-faint">
        {label}
        {hint ? <span className="normal-case tracking-normal"> · {hint}</span> : null}
      </span>
      {children}
    </label>
  );
}
