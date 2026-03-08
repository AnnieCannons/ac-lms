"use client";

import { useEffect, useRef } from "react";
import DOMPurify from "isomorphic-dompurify";

export default function HtmlContent({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const clean = DOMPurify.sanitize(html);

  useEffect(() => {
    if (!ref.current) return;
    ref.current.querySelectorAll("a").forEach((a) => {
      a.target = "_blank";
      a.rel = "noopener noreferrer";
    });
  }, [html]);

  return (
    <div
      ref={ref}
      className={`wiki-content${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
