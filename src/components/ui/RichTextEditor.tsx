"use client";

import { useState, useRef, useEffect } from "react";
import { useEditor, EditorContent, ReactNodeViewRenderer } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import Link from "@tiptap/extension-link";
import { getMarkRange } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { createClient } from "@/lib/supabase/client";
import ImageResizeNode from "./ImageResizeNode";

type Props = {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  storagePath?: string;
};

type HoveredLink = { href: string; top: number; left: number; domEl: HTMLAnchorElement };

export default function RichTextEditor({ content, onChange, placeholder, storagePath }: Props) {
  const [uploadingImage, setUploadingImage] = useState(false);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!storagePath) return null;
    setUploadingImage(true);
    const supabase = createClient();
    const safeName = `${Date.now()}_${file.name.replace(/\s+/g, "_")}`;
    const filePath = `${storagePath}${safeName}`;
    const { error } = await supabase.storage.from("lms-resources").upload(filePath, file, { upsert: true });
    setUploadingImage(false);
    if (error) { alert(`Image upload failed: ${error.message}`); return null; }
    const { data } = supabase.storage.from("lms-resources").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const insertImageUrl = (url: string, name: string) => {
    editor?.chain().focus().insertContent(`<img src="${url}" alt="${name.replace(/"/g, "&quot;")}" />`).run();
  };

  const handleImageFile = async (file: File) => {
    const url = await uploadImage(file);
    if (url) insertImageUrl(url, file.name);
  };

  // Add-link input (shown below toolbar when adding new link)
  const [linkInputOpen, setLinkInputOpen] = useState(false);
  const [linkUrlDraft, setLinkUrlDraft] = useState("");
  const linkInputRef = useRef<HTMLInputElement>(null);

  // Floating link hover popup
  const [hoveredLink, setHoveredLink] = useState<HoveredLink | null>(null);
  const [popupEditing, setPopupEditing] = useState(false);
  const [editText, setEditText] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const popupRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder: placeholder ?? "Write something…" }),
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { class: "text-teal-primary underline cursor-pointer" },
      }),
      Image.extend({
        addAttributes() {
          return { ...this.parent?.(), width: { default: null } };
        },
        addNodeView() {
          return ReactNodeViewRenderer(ImageResizeNode);
        },
      }).configure({ inline: true }),
    ],
    content,
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      onChange(html === "<p></p>" ? "" : html);
    },
    editorProps: {
      attributes: {
        class:
          "min-h-[300px] max-h-[800px] overflow-y-auto focus:outline-none text-sm text-dark-text bg-background leading-relaxed px-3 py-2",
      },
      handlePaste: (_view, event) => {
        if (!storagePath) return false;
        const items = Array.from(event.clipboardData?.items ?? []);
        const imageItem = items.find(item => item.type.startsWith("image/"));
        if (!imageItem) return false;
        const file = imageItem.getAsFile();
        if (!file) return false;
        event.preventDefault();
        handleImageFile(file);
        return true;
      },
    },
  });

  // Track mouse position globally so we can check it when hide timer fires
  useEffect(() => {
    const onMove = (e: MouseEvent) => { mousePos.current = { x: e.clientX, y: e.clientY }; };
    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  // Hover listeners on editor DOM
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom as HTMLElement;

    function scheduleHide() {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      hideTimer.current = setTimeout(() => {
        // Check actual mouse position at fire time — avoids false hides when crossing the gap
        const el = document.elementFromPoint(mousePos.current.x, mousePos.current.y);
        if (popupRef.current?.contains(el as Node)) return; // mouse is over popup
        if ((el as HTMLElement)?.closest?.("a")) return;    // mouse is over a link
        setHoveredLink(null);
        setPopupEditing(false);
      }, 200);
    }

    function cancelHide() {
      if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; }
    }

    function onMouseOver(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      cancelHide();
      const rect = anchor.getBoundingClientRect();
      const popW = 280;
      const left = Math.min(rect.left, window.innerWidth - popW - 12);
      setHoveredLink({
        href: anchor.getAttribute("href") ?? "",
        top: rect.bottom + 6,
        left: Math.max(8, left),
        domEl: anchor,
      });
    }

    function onMouseOut(e: MouseEvent) {
      const related = e.relatedTarget as HTMLElement | null;
      if (popupRef.current?.contains(related)) return;
      scheduleHide();
    }

    dom.addEventListener("mouseover", onMouseOver);
    dom.addEventListener("mouseout", onMouseOut);
    return () => {
      dom.removeEventListener("mouseover", onMouseOver);
      dom.removeEventListener("mouseout", onMouseOut);
    };
  }, [editor]);

  // Focus add-link input when it opens
  useEffect(() => {
    if (linkInputOpen) linkInputRef.current?.focus();
  }, [linkInputOpen]);

  if (!editor) return null;
  const ed = editor;

  const hasStoredMark = (name: string) =>
    !!(editor.state.storedMarks?.find((m) => m.type.name === name));
  const isBold = editor.isActive("bold") || hasStoredMark("bold");
  const isItalic = editor.isActive("italic") || hasStoredMark("italic");
  const isLinkActive = editor.isActive("link");

  const btn = (active: boolean) =>
    `px-2 py-1 rounded text-xs font-medium transition-colors ${
      active ? "bg-purple-primary text-white" : "text-muted-text hover:bg-border/40 hover:text-dark-text"
    }`;
  const tool = (fn: () => void) => (e: React.MouseEvent) => { e.preventDefault(); fn(); };

  function handleLinkButton(e: React.MouseEvent) {
    e.preventDefault();
    if (isLinkActive) { ed.chain().focus().unsetLink().run(); return; }
    const { from, to } = ed.state.selection;
    if (from === to) return;
    setLinkUrlDraft("");
    setLinkInputOpen(true);
  }

  function applyLink() {
    const url = linkUrlDraft.trim();
    if (!url) { setLinkInputOpen(false); return; }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    ed.chain().focus().setLink({ href }).run();
    setLinkInputOpen(false);
    setLinkUrlDraft("");
  }

  function openEdit() {
    if (!hoveredLink) return;
    setEditText(hoveredLink.domEl.textContent ?? "");
    setEditUrl(hoveredLink.href);
    setPopupEditing(true);
  }

  function saveEdit() {
    if (!hoveredLink) return;
    const url = editUrl.trim();
    if (!url) { setPopupEditing(false); return; }
    const href = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    try {
      const pos = ed.view.posAtDOM(hoveredLink.domEl, 0);
      const $pos = ed.state.doc.resolve(pos);
      const range = getMarkRange($pos, ed.schema.marks.link);
      if (range) {
        ed.chain()
          .focus()
          .setTextSelection({ from: range.from, to: range.to })
          .insertContent({ type: "text", text: editText || " ", marks: [{ type: "link", attrs: { href } }] })
          .run();
      } else {
        ed.chain().focus().extendMarkRange("link").updateAttributes("link", { href }).run();
      }
    } catch {
      ed.chain().focus().extendMarkRange("link").updateAttributes("link", { href }).run();
    }
    setPopupEditing(false);
    setHoveredLink(null);
  }

  function removeLink() {
    if (!hoveredLink) return;
    try {
      const pos = ed.view.posAtDOM(hoveredLink.domEl, 0);
      const $pos = ed.state.doc.resolve(pos);
      const range = getMarkRange($pos, ed.schema.marks.link);
      if (range) {
        ed.chain().focus().setTextSelection({ from: range.from, to: range.to }).unsetLink().run();
      } else {
        ed.chain().focus().extendMarkRange("link").unsetLink().run();
      }
    } catch {
      ed.chain().focus().extendMarkRange("link").unsetLink().run();
    }
    setHoveredLink(null);
  }

  function copyLink() {
    navigator.clipboard.writeText(hoveredLink?.href ?? "").then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  return (
    <div className="border border-border rounded-lg bg-background overflow-hidden focus-within:ring-2 focus-within:ring-teal-primary">
      {/* Toolbar */}
      <div role="toolbar" aria-label="Text formatting" className="flex items-center gap-0.5 px-2 py-1.5 border-b border-border bg-surface flex-wrap">
        <button type="button" onMouseDown={tool(() => editor.chain().focus().toggleBold().run())} className={btn(isBold)} aria-label="Bold" aria-pressed={isBold}>B</button>
        <button type="button" onMouseDown={tool(() => editor.chain().focus().toggleItalic().run())} className={`${btn(isItalic)} italic`} aria-label="Italic" aria-pressed={isItalic}>I</button>
        <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={tool(() => editor.chain().focus().toggleHeading({ level: 2 }).run())} className={btn(editor.isActive("heading", { level: 2 }))} aria-label="Heading 2">H2</button>
        <button type="button" onMouseDown={tool(() => editor.chain().focus().toggleHeading({ level: 3 }).run())} className={btn(editor.isActive("heading", { level: 3 }))} aria-label="Heading 3">H3</button>
        <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={tool(() => editor.chain().focus().toggleBulletList().run())} className={btn(editor.isActive("bulletList"))} aria-label="Bullet list">• List</button>
        <button type="button" onMouseDown={tool(() => editor.chain().focus().toggleOrderedList().run())} className={btn(editor.isActive("orderedList"))} aria-label="Numbered list">1. List</button>
        <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={tool(() => editor.chain().focus().toggleBlockquote().run())} className={btn(editor.isActive("blockquote"))} aria-label="Blockquote">&ldquo; Quote</button>
        <button type="button" onMouseDown={tool(() => editor.chain().focus().toggleCode().run())} className={`${btn(editor.isActive("code"))} font-mono`} aria-label="Inline code">`</button>
        <button type="button" onMouseDown={tool(() => editor.chain().focus().toggleCodeBlock().run())} className={`${btn(editor.isActive("codeBlock"))} font-mono`} aria-label="Code block">```</button>
        <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-border mx-1" />
        <button type="button" onMouseDown={handleLinkButton} className={btn(isLinkActive)} aria-label={isLinkActive ? "Remove link" : "Add link"} title={isLinkActive ? "Remove link" : "Add link (select text first)"}>
          🔗
        </button>
        {storagePath && (
          <>
            <div role="separator" aria-orientation="vertical" className="w-px h-4 bg-border mx-1" />
            <button
              type="button"
              onMouseDown={e => { e.preventDefault(); imageInputRef.current?.click(); }}
              className={btn(false)}
              aria-label="Insert image"
              title={uploadingImage ? "Uploading…" : "Insert image (or paste with ⌘V)"}
              disabled={uploadingImage}
            >
              {uploadingImage ? "…" : "img"}
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleImageFile(f); e.target.value = ""; }}
            />
          </>
        )}
      </div>

      {/* Inline URL input for adding a new link */}
      {linkInputOpen && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-surface">
          <input
            ref={linkInputRef}
            type="url"
            value={linkUrlDraft}
            onChange={e => setLinkUrlDraft(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter") { e.preventDefault(); applyLink(); }
              if (e.key === "Escape") setLinkInputOpen(false);
            }}
            placeholder="https://..."
            className="flex-1 text-xs border border-border rounded px-2 py-1 bg-background text-dark-text focus:outline-none focus:ring-1 focus:ring-teal-primary"
          />
          <button type="button" onMouseDown={e => { e.preventDefault(); applyLink(); }} className="text-xs px-2 py-1 rounded bg-teal-primary text-white hover:opacity-80 transition-opacity">Add</button>
          <button type="button" onMouseDown={e => { e.preventDefault(); setLinkInputOpen(false); }} className="text-xs px-2 py-1 rounded text-muted-text hover:text-dark-text transition-colors">Cancel</button>
        </div>
      )}

      {/* Editor area */}
      <EditorContent editor={editor} />

      {/* Floating link popup (hover-triggered) */}
      {hoveredLink && (
        <div
          ref={popupRef}
          className="fixed z-50 bg-surface border border-border rounded-xl shadow-lg text-xs overflow-hidden"
          style={{ top: hoveredLink.top, left: hoveredLink.left, width: 280 }}
          onMouseEnter={() => { if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null; } }}
          onMouseLeave={() => {
            if (hideTimer.current) clearTimeout(hideTimer.current);
            hideTimer.current = setTimeout(() => {
              const el = document.elementFromPoint(mousePos.current.x, mousePos.current.y);
              if ((el as HTMLElement)?.closest?.("a")) return;
              setHoveredLink(null);
              setPopupEditing(false);
            }, 200);
          }}
        >
          {popupEditing ? (
            <div className="p-3 flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <span className="text-muted-text w-8 shrink-0">Text</span>
                <input autoFocus type="text" value={editText} onChange={e => setEditText(e.target.value)}
                  className="flex-1 border border-border rounded px-2 py-1 bg-background text-dark-text focus:outline-none focus:ring-1 focus:ring-teal-primary text-xs" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-muted-text w-8 shrink-0">URL</span>
                <input type="url" value={editUrl} onChange={e => setEditUrl(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); saveEdit(); } if (e.key === "Escape") setPopupEditing(false); }}
                  className="flex-1 border border-border rounded px-2 py-1 bg-background text-dark-text focus:outline-none focus:ring-1 focus:ring-teal-primary text-xs" />
              </div>
              <div className="flex gap-2 pt-0.5">
                <button type="button" onClick={saveEdit} className="px-3 py-1 rounded bg-teal-primary text-white hover:opacity-80 transition-opacity text-xs">Save</button>
                <button type="button" onClick={() => setPopupEditing(false)} className="px-2 py-1 rounded text-muted-text hover:text-dark-text transition-colors text-xs">Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border">
                <svg className="w-3 h-3 text-teal-primary shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                </svg>
                <a href={hoveredLink.href} target="_blank" rel="noopener noreferrer"
                  className="flex-1 text-teal-primary hover:underline truncate" title={hoveredLink.href}>
                  {hoveredLink.href}
                </a>
                <button type="button" onClick={copyLink} className="shrink-0 text-muted-text hover:text-dark-text transition-colors px-1" title="Copy link">
                  {copied ? "✓" : (
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                  )}
                </button>
              </div>
              <div className="flex items-center divide-x divide-border">
                <button type="button" onClick={openEdit} className="flex-1 py-1.5 text-center text-muted-text hover:text-dark-text hover:bg-border/20 transition-colors">Edit</button>
                <button type="button" onClick={removeLink} className="flex-1 py-1.5 text-center text-muted-text hover:text-red-500 hover:bg-red-500/10 transition-colors">Remove</button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
