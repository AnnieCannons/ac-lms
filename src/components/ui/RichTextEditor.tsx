"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";

type Props = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
};

export default function RichTextEditor({ content, onChange, placeholder }: Props) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? "Write something…" }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[180px] max-h-[400px] overflow-y-auto focus:outline-none text-sm text-gray-700 leading-relaxed px-3 py-2",
      },
    },
  });

  if (!editor) return null;

  // Check stored marks (queued for next typed character) as well as active marks
  const hasStoredMark = (name: string) =>
    !!(editor.state.storedMarks?.find((m) => m.type.name === name));

  const isBold = editor.isActive("bold") || hasStoredMark("bold");
  const isItalic = editor.isActive("italic") || hasStoredMark("italic");

  const btn = (active: boolean) =>
    `px-2 py-1 rounded text-xs font-medium transition-colors ${
      active
        ? "bg-teal-primary text-white"
        : "text-gray-600 hover:bg-gray-100"
    }`;

  // Run command on mousedown (before blur) instead of onClick
  const tool = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden focus-within:ring-2 focus-within:ring-teal-primary">
      {/* Toolbar */}
      <div role="toolbar" aria-label="Text formatting" className="flex items-center gap-0.5 px-2 py-1.5 border-b border-gray-100 flex-wrap">
        <button
          type="button"
          onMouseDown={tool(() => editor.chain().focus().toggleBold().run())}
          className={btn(isBold)}
          aria-label="Bold"
          aria-pressed={isBold}
        >
          B
        </button>
        <button
          type="button"
          onMouseDown={tool(() => editor.chain().focus().toggleItalic().run())}
          className={`${btn(isItalic)} italic`}
          aria-label="Italic"
          aria-pressed={isItalic}
        >
          I
        </button>
        <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-gray-200 mx-1" />
        <button
          type="button"
          onMouseDown={tool(() => editor.chain().focus().toggleHeading({ level: 2 }).run())}
          className={btn(editor.isActive("heading", { level: 2 }))}
          aria-label="Heading 2"
          aria-pressed={editor.isActive("heading", { level: 2 })}
        >
          H2
        </button>
        <button
          type="button"
          onMouseDown={tool(() => editor.chain().focus().toggleHeading({ level: 3 }).run())}
          className={btn(editor.isActive("heading", { level: 3 }))}
          aria-label="Heading 3"
          aria-pressed={editor.isActive("heading", { level: 3 })}
        >
          H3
        </button>
        <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-gray-200 mx-1" />
        <button
          type="button"
          onMouseDown={tool(() => editor.chain().focus().toggleBulletList().run())}
          className={btn(editor.isActive("bulletList"))}
          aria-label="Bullet list"
          aria-pressed={editor.isActive("bulletList")}
        >
          • List
        </button>
        <button
          type="button"
          onMouseDown={tool(() => editor.chain().focus().toggleOrderedList().run())}
          className={btn(editor.isActive("orderedList"))}
          aria-label="Numbered list"
          aria-pressed={editor.isActive("orderedList")}
        >
          1. List
        </button>
        <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-gray-200 mx-1" />
        <button
          type="button"
          onMouseDown={tool(() => editor.chain().focus().toggleBlockquote().run())}
          className={btn(editor.isActive("blockquote"))}
          aria-label="Blockquote"
          aria-pressed={editor.isActive("blockquote")}
        >
          " Quote
        </button>
      </div>

      {/* Editor area */}
      <EditorContent editor={editor} />
    </div>
  );
}
