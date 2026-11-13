import { ReactNodeViewRenderer } from "@tiptap/react";
import { mergeAttributes } from "@tiptap/core";
import CodeBlockLowlight from "@tiptap/extension-code-block-lowlight";
import { createLowlight } from "lowlight";
import javascript from "highlight.js/lib/languages/javascript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";
import CodeBlockNode from "@/components/ui/CodeBlockNode";

const lowlight = createLowlight();
lowlight.register("javascript", javascript);
lowlight.register("jsx", javascript); // JSX uses the JS grammar
lowlight.register("html", xml);
lowlight.register("css", css);
lowlight.register("sql", sql);

/**
 * The syntax-highlighted code block shared by every editor: a language picker and remove
 * button (CodeBlockNode), saved as <pre><code class="language-x">. Use with
 * StarterKit.configure({ codeBlock: false }). With no language the code is auto-detected.
 */
export function codeBlockExtension(defaultLanguage: string | null) {
  return CodeBlockLowlight.extend({
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
  }).configure({ lowlight, defaultLanguage });
}
