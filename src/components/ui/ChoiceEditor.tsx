"use client";

import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import { mergeAttributes } from "@tiptap/core";
import { useRef } from "react";
import StarterKit from "@tiptap/starter-kit";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";
import javascript from "highlight.js/lib/languages/javascript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import FileUpload from "@/components/ui/FileUpload";
import CodeBlockNode from "@/components/ui/CodeBlockNode";

const lowlight = createLowlight();
lowlight.register("javascript", javascript);
lowlight.register("jsx", javascript);
lowlight.register("html", xml);
lowlight.register("css", css);
lowlight.register("sql", sql);

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
        codeBlock: false, // replaced by CodeBlockLowlight
        heading: false,
        horizontalRule: false,
        blockquote: false,
        bulletList: false,
        orderedList: false,
        listItem: false,
      }),
      CodeBlockLowlight.extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockNode);
        },
        renderHTML({ node, HTMLAttributes }) {
          return [
            "pre",
            mergeAttributes(HTMLAttributes),
            ["code", { class: node.attrs.language ? `language-${node.attrs.language}` : null }, 0],
          ];
        },
      }).configure({
        lowlight,
        defaultLanguage: "javascript",
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
          "min-h-[52px] max-h-[200px] overflow-y-auto focus:outline-none text-sm text-dark-text bg-background leading-relaxed px-3 py-2",
      },
    },
  });

  if (!editor) return null;

  const isCode = editor.isActive("code");
  const isCodeBlock = editor.isActive("codeBlock");

  const tool = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  const btn = (active: boolean) =>
    `px-2 py-0.5 rounded text-xs font-mono font-medium transition-colors ${
      active
        ? "bg-teal-primary text-white"
        : "text-muted-text hover:text-dark-text hover:bg-border/40"
    }`;

  const insertImage = (url: string, fileName: string) => {
    const img = `<img src="${url}" alt="${fileName.replace(/"/g, "&quot;")}" />`;
    editor.chain().focus().insertContent(img).run();
  };

  const handleInlineCode = () => {
    if (editor.isActive("codeBlock")) {
      // Convert code block → inline code paragraph
      editor
        .chain()
        .focus()
        .command(({ tr, state }) => {
          const { $anchor } = state.selection;
          let cbPos = -1, cbSize = 0, cbText = "";
          state.doc.descendants((node, pos) => {
            if (
              node.type.name === "codeBlock" &&
              pos <= $anchor.pos &&
              pos + node.nodeSize >= $anchor.pos
            ) {
              cbPos = pos;
              cbSize = node.nodeSize;
              cbText = node.textContent;
              return false;
            }
          });
          if (cbPos === -1) return false;
          const { schema } = state;
          tr.replaceWith(
            cbPos,
            cbPos + cbSize,
            schema.nodes.paragraph.create(
              null,
              cbText ? schema.text(cbText, [schema.marks.code.create()]) : undefined
            )
          );
          return true;
        })
        .run();
    } else {
      editor.chain().focus().toggleCode().run();
    }
  };

  const handleCodeBlock = () => {
    if (editor.isActive("codeBlock")) {
      editor.chain().focus().toggleCodeBlock().run();
      return;
    }
    const { from, to, empty } = editor.state.selection;
    if (!empty) {
      const selectedText = editor.state.doc.textBetween(from, to, "\n", "\n");
      editor
        .chain()
        .focus()
        .deleteSelection()
        .insertContent({
          type: "codeBlock",
          attrs: { language: "javascript" },
          content: selectedText ? [{ type: "text", text: selectedText }] : [],
        })
        .run();
    } else {
      editor.chain().focus().toggleCodeBlock().run();
    }
  };

  return (
    <div className="border border-border rounded-lg bg-background overflow-hidden focus-within:ring-2 focus-within:ring-teal-primary">
      <div className="flex items-center gap-0.5 px-2 py-1 border-b border-border bg-surface">
        <button
          type="button"
          onMouseDown={tool(handleInlineCode)}
          className={btn(isCode)}
          aria-label="Inline code"
          aria-pressed={isCode}
          title="Inline code (single line)"
        >
          `code`
        </button>
        <button
          type="button"
          onMouseDown={tool(handleCodeBlock)}
          className={btn(isCodeBlock)}
          aria-label="Code block"
          aria-pressed={isCodeBlock}
          title="Code block (multi-line)"
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
