"use client";

import { useState, useEffect } from "react";
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

interface Props {
  html: string;
  className?: string;
}

function highlight(html: string): string {
  const clean = DOMPurify.sanitize(html);
  if (typeof document === "undefined") return clean;
  const div = document.createElement("div");
  div.innerHTML = clean;
  div.querySelectorAll("pre code").forEach((block) => {
    const el = block as HTMLElement;
    const pre = el.parentElement;

    let language = "";
    for (const cls of [...el.classList]) {
      if (cls.startsWith("language-")) { language = cls.slice(9); break; }
    }
    if (!language && pre) {
      for (const cls of [...pre.classList]) {
        if (cls.startsWith("language-")) { language = cls.slice(9); break; }
      }
    }
    if (!language) language = "javascript";

    const code = el.textContent ?? "";
    try {
      const result = hljs.highlight(code, { language, ignoreIllegals: true });
      el.innerHTML = result.value;
    } catch {
      // Unknown language — base styles still apply
    }
    el.classList.add("hljs");
  });
  return div.innerHTML;
}

export default function HighlightedContent({ html, className }: Props) {
  const [displayHtml, setDisplayHtml] = useState(() => DOMPurify.sanitize(html));

  useEffect(() => {
    setDisplayHtml(highlight(html));
  }, [html]);

  return (
    <div
      className={className}
      dangerouslySetInnerHTML={{ __html: displayHtml }}
      suppressHydrationWarning
    />
  );
}
