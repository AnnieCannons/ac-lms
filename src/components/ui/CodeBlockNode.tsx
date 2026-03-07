"use client";

import { NodeViewContent, NodeViewWrapper } from "@tiptap/react";
import type { NodeViewProps } from "@tiptap/react";

const LANGUAGES = [
  { value: "", label: "Plain text" },
  { value: "javascript", label: "JavaScript" },
  { value: "jsx", label: "React (JSX)" },
  { value: "html", label: "HTML" },
  { value: "css", label: "CSS" },
  { value: "sql", label: "SQL" },
];

export default function CodeBlockNode({ node, updateAttributes }: NodeViewProps) {
  const lang = (node.attrs.language as string) || "";

  return (
    <NodeViewWrapper className="relative my-3 not-italic">
      <div
        contentEditable={false}
        className="absolute top-2 right-2 z-10 select-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <select
          value={lang}
          onChange={(e) => updateAttributes({ language: e.target.value || null })}
          className="text-xs bg-[#1e1e2e] text-[#a6adc8] border border-[#313244] rounded px-2 py-0.5 focus:outline-none cursor-pointer hover:border-[#89b4fa] transition-colors appearance-none pr-6"
          style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%23a6adc8'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 6px center" }}
        >
          {LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
      <pre className="!m-0 rounded-lg overflow-x-auto text-sm leading-relaxed" style={{ background: "#1e1e2e", padding: "2.5rem 1rem 1rem" }}>
        {/* NodeViewContent renders the code; cast needed due to @tiptap/react types */}
        <NodeViewContent as={"code" as "div"} />
      </pre>
    </NodeViewWrapper>
  );
}
