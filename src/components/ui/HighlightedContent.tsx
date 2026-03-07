"use client";

import { useEffect, useRef } from "react";
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

export default function HighlightedContent({ html, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const clean = DOMPurify.sanitize(html);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.querySelectorAll("pre code").forEach((block) => {
      const el = block as HTMLElement;
      const pre = el.parentElement;

      // Detect language from <code> class, then <pre> class, then default to javascript
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

      // Use hljs.highlight() directly — more reliable than highlightElement()
      // which can silently skip elements it thinks are already processed
      const code = el.textContent ?? "";
      try {
        const result = hljs.highlight(code, { language, ignoreIllegals: true });
        el.innerHTML = result.value;
        el.classList.add("hljs");
      } catch {
        // Unknown language — add class so base theme styles still apply
        el.classList.add("hljs");
      }
    });
  }, [html]);

  return (
    <div
      ref={ref}
      className={className}
      dangerouslySetInnerHTML={{ __html: clean }}
      suppressHydrationWarning
    />
  );
}
