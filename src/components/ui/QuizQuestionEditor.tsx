"use client";

import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import { mergeAttributes } from "@tiptap/core";
import { useRef } from "react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
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
lowlight.register("jsx", javascript); // JSX uses the JS grammar
lowlight.register("html", xml);
lowlight.register("css", css);
lowlight.register("sql", sql);

type Props = {
  initialContent: string;
  onChange: (html: string) => void;
  storagePath?: string;
};

export default function QuizQuestionEditor({ initialContent, onChange, storagePath }: Props) {
  // Always call the latest onChange even if the editor was created with a stale closure
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
      Placeholder.configure({ placeholder: "Question text…" }),
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChangeRef.current(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[120px] max-h-[500px] overflow-y-auto focus:outline-none text-sm text-dark-text bg-background leading-relaxed px-3 py-2 " +
          "[&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 " +
          "[&_li_p]:inline [&_strong]:font-bold [&_em]:italic",
      },
    },
  });

  if (!editor) return null;

  const hasStoredMark = (name: string) =>
    !!(editor.state.storedMarks?.find((m) => m.type.name === name));

  const isBold = editor.isActive("bold") || hasStoredMark("bold");
  const isItalic = editor.isActive("italic") || hasStoredMark("italic");

  const tool = (fn: () => void) => (e: React.MouseEvent) => {
    e.preventDefault();
    fn();
  };

  const btn = (active: boolean) =>
    `px-2 py-1 rounded text-xs font-medium transition-colors ${
      active
        ? "bg-teal-primary text-white"
        : "text-muted-text hover:text-dark-text hover:bg-border/40"
    }`;

  const insertImage = (url: string, fileName: string) => {
    const img = `<img src="${url}" alt="${fileName.replace(/"/g, "&quot;")}" />`;
    editor.chain().focus().insertContent(img).run();
  };

  return (
    <div className="border border-border rounded-lg bg-background overflow-hidden focus-within:ring-2 focus-within:ring-teal-primary">
      {/* Toolbar */}
      <div
        role="toolbar"
        aria-label="Text formatting"
        className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-surface flex-wrap"
      >
        <button
          type="button"
          onMouseDown={tool(() => editor.chain().focus().toggleBold().run())}
          className={`${btn(isBold)} font-bold`}
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

        <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-border mx-1 shrink-0" />

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

        <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-border mx-1 shrink-0" />

        <button
          type="button"
          onMouseDown={tool(() => {
            if (editor.isActive('codeBlock')) {
              // Convert code block → inline code paragraph
              editor.chain().focus()
                .command(({ tr, state }) => {
                  const { $anchor } = state.selection
                  let codeBlockPos = -1
                  let codeBlockSize = 0
                  let codeBlockText = ''
                  state.doc.descendants((node, pos) => {
                    if (node.type.name === 'codeBlock' && pos <= $anchor.pos && pos + node.nodeSize >= $anchor.pos) {
                      codeBlockPos = pos
                      codeBlockSize = node.nodeSize
                      codeBlockText = node.textContent
                      return false
                    }
                  })
                  if (codeBlockPos === -1) return false
                  const { schema } = state
                  const content = codeBlockText
                    ? schema.text(codeBlockText, [schema.marks.code.create()])
                    : undefined
                  tr.replaceWith(codeBlockPos, codeBlockPos + codeBlockSize,
                    schema.nodes.paragraph.create(null, content))
                  return true
                })
                .run()
            } else {
              editor.chain().focus().toggleCode().run()
            }
          })}
          className={`${btn(editor.isActive("code"))} font-mono`}
          aria-label="Inline code"
          aria-pressed={editor.isActive("code")}
        >
          `code`
        </button>
        <button
          type="button"
          onMouseDown={tool(() => {
            if (editor.isActive('codeBlock')) {
              editor.chain().focus().toggleCodeBlock().run()
              return
            }
            const { from, to, empty } = editor.state.selection
            if (!empty) {
              const selectedText = editor.state.doc.textBetween(from, to, '\n', '\n')
              editor.chain().focus()
                .deleteSelection()
                .insertContent({
                  type: 'codeBlock',
                  attrs: { language: 'javascript' },
                  content: selectedText ? [{ type: 'text', text: selectedText }] : [],
                })
                .run()
            } else {
              editor.chain().focus().toggleCodeBlock().run()
            }
          })}
          className={btn(editor.isActive("codeBlock"))}
          aria-label="Code block"
          aria-pressed={editor.isActive("codeBlock")}
          title="Insert code block (pick language inside)"
        >
          {"</>"}
        </button>

        {storagePath && (
          <>
            <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-border mx-1 shrink-0" />
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

      {/* Editor */}
      <EditorContent editor={editor} />
    </div>
  );
}
