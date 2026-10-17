"use client";

import { EditorContent, useEditor, type JSONContent } from "@tiptap/react";
import { editorExtensions } from "@/lib/editor";

const TOOLS = [
  { key: "bold", label: "Negrita", glyph: "B", className: "font-bold" },
  { key: "italic", label: "Itálica", glyph: "I", className: "italic" },
  { key: "underline", label: "Subrayado", glyph: "U", className: "underline" },
  { key: "bulletList", label: "Lista", glyph: "•—", className: "" },
  { key: "orderedList", label: "Lista numerada", glyph: "1—", className: "" },
  { key: "blockquote", label: "Cita", glyph: "❝", className: "" },
] as const;

export function BodyEditor({
  value,
  onChange,
}: {
  value: JSONContent | null;
  onChange: (next: JSONContent) => void;
}) {
  const editor = useEditor({
    extensions: editorExtensions,
    content: value ?? "",
    // Tiptap no debe renderizar en el servidor: rompería la hidratación.
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "doc-body px-4 py-3" },
    },
    onUpdate: ({ editor }) => onChange(editor.getJSON()),
  });

  if (!editor) {
    return (
      <div className="h-48 animate-pulse border border-rule bg-surface-2" />
    );
  }

  return (
    <div className="border border-rule bg-surface">
      <div className="flex flex-wrap gap-1 border-b border-rule px-2 py-1.5">
        {TOOLS.map((tool) => {
          const active = editor.isActive(tool.key);
          return (
            <button
              key={tool.key}
              type="button"
              title={tool.label}
              aria-label={tool.label}
              aria-pressed={active}
              onClick={() => {
                const chain = editor.chain().focus();
                if (tool.key === "bold") chain.toggleBold().run();
                else if (tool.key === "italic") chain.toggleItalic().run();
                else if (tool.key === "underline") chain.toggleUnderline().run();
                else if (tool.key === "bulletList") chain.toggleBulletList().run();
                else if (tool.key === "orderedList") chain.toggleOrderedList().run();
                else chain.toggleBlockquote().run();
              }}
              className={`min-w-8 px-2 py-1 font-util text-sm transition-colors ${tool.className} ${
                active
                  ? "bg-accent-soft text-accent"
                  : "text-ink-faint hover:text-ink"
              }`}
            >
              {tool.glyph}
            </button>
          );
        })}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
