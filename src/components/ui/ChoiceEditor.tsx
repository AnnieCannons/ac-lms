"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import { useRef } from "react";
import StarterKit from "@tiptap/starter-kit";
import FileUpload from "@/components/ui/FileUpload";

type Props = {
  initialContent: string;
  onChange: (html: string) => void;
  storagePath?: string;
};

export default function ChoiceEditor({ initialContent, onChange, storagePath }: Props) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: false,
        horizontalRule: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChangeRef.current(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[52px] max-h-[200px] overflow-y-auto focus:outline-none text-sm text-dark-text leading-relaxed px-3 py-2",
      },
    },
  });

  if (!editor) return null;

  const isCode = editor.isActive("code");
  const isCodeBlock = editor.isActive("codeBlock");

  const insertImage = (url: string, fileName: string) => {
    const img = `<img src="${url}" alt="${fileName.replace(/"/g, "&quot;")}" />`;
    editor.chain().focus().insertContent(img).run();
  };

  return (
    <div className="border border-border rounded-lg bg-background overflow-hidden focus-within:ring-2 focus-within:ring-teal-primary">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-surface">
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleCode().run();
          }}
          className={`px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors ${
            isCode
              ? "bg-teal-primary text-white"
              : "text-muted-text hover:text-dark-text hover:bg-border/40"
          }`}
          aria-label="Inline code"
          aria-pressed={isCode}
        >
          `code`
        </button>
        <button
          type="button"
          onMouseDown={(e) => {
            e.preventDefault();
            editor.chain().focus().toggleCodeBlock().run();
          }}
          className={`px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors ${
            isCodeBlock
              ? "bg-teal-primary text-white"
              : "text-muted-text hover:text-dark-text hover:bg-border/40"
          }`}
          aria-label="Code block"
          aria-pressed={isCodeBlock}
        >
          {"</>"}
        </button>
        {storagePath && (
          <>
            <div className="w-px h-3.5 bg-border mx-1 shrink-0" />
            <span className="text-xs text-muted-text">img:</span>
            <FileUpload
              bucket="lms-resources"
              path={storagePath}
              accept="image/*"
              onUpload={insertImage}
            />
          </>
        )}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
