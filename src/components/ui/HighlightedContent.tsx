"use client";

import { useMemo } from "react";
import DOMPurify from "isomorphic-dompurify";
import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import sql from "highlight.js/lib/languages/sql";

hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("jsx", javascript);
hljs.registerLanguage("html", xml);
hljs.registerLanguage("css", css);
hljs.registerLanguage("sql", sql);

const CODE_FONT = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace";

function applyPre(pre: HTMLElement) {
  pre.style.background = "#1e1e2e";
  pre.style.border = "1px solid #313244";
  pre.style.borderRadius = "8px";
  pre.style.padding = "0.75rem 1rem";
  pre.style.margin = "0.5rem 0";
  pre.style.overflowX = "auto";
  pre.style.whiteSpace = "pre";
  pre.style.fontFamily = CODE_FONT;
  pre.style.fontSize = "0.85rem";
  pre.style.lineHeight = "1.6";
}

function applyCode(code: HTMLElement) {
  code.style.background = "transparent";
  code.style.padding = "0";
  code.style.display = "block";
  code.style.fontFamily = CODE_FONT;
  code.style.fontSize = "inherit";
  code.style.color = "#cdd6f4";
}

function highlightCode(code: HTMLElement, pre: HTMLElement | null) {
  let lang = "";
  for (const cls of [...code.classList, ...(pre ? [...pre.classList] : [])]) {
    if (cls.startsWith("language-")) { lang = cls.slice(9); break; }
  }
  if (!lang) lang = "javascript";

  const text = code.textContent ?? "";
  if (!text.trim()) return;

  try {
    const result = hljs.highlight(text, { language: lang, ignoreIllegals: true });
    code.innerHTML = result.value;
    code.classList.add("hljs");
  } catch {
    try {
      const auto = hljs.highlightAuto(text);
      code.innerHTML = auto.value;
      code.classList.add("hljs");
    } catch {
      code.classList.add("hljs");
    }
  }
}

function processHtml(html: string): string {
  const clean = DOMPurify.sanitize(html);
  // SSR: return sanitized HTML only; client will hydrate with highlighted version
  if (typeof document === "undefined") return clean;

  const container = document.createElement("div");
  container.innerHTML = clean;

  container.querySelectorAll<HTMLElement>("pre").forEach((pre) => {
    applyPre(pre);

    let code = pre.querySelector<HTMLElement>("code");
    if (!code) {
      // Some HTML (e.g. Notion exports) uses <br> inside <pre> instead of newlines.
      // Replace <br> with actual \n before reading textContent, or they'll be lost.
      pre.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
      const text = pre.textContent ?? "";
      pre.textContent = "";
      code = document.createElement("code");
      code.textContent = text;
      pre.appendChild(code);
    } else {
      // Also fix <br> inside the code element (mixed formats from imports)
      code.querySelectorAll("br").forEach((br) => br.replaceWith("\n"));
    }

    applyCode(code);
    highlightCode(code, pre);
    applyCode(code);
  });

  container.querySelectorAll("a").forEach((a: Element) => {
    (a as HTMLAnchorElement).target = "_blank";
    (a as HTMLAnchorElement).rel = "noopener noreferrer";
  });

  return container.innerHTML;
}

interface Props {
  html: string;
  className?: string;
}

export default function HighlightedContent({ html, className }: Props) {
  // Compute highlighted HTML eagerly so it's baked into dangerouslySetInnerHTML.
  // Using useMemo instead of useEffect avoids the race where React rewrites innerHTML
  // on re-renders before the effect gets a chance to re-apply syntax highlighting.
  const processed = useMemo(() => processHtml(html), [html]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: processed }}
      suppressHydrationWarning
    />
  );
}
