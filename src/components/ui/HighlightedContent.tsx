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
      hljs.highlightElement(block as HTMLElement);
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
