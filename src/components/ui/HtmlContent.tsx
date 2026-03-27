"use client";

import DOMPurify from "isomorphic-dompurify";

export default function HtmlContent({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  // Force all links to open in a new tab during sanitization so it's
  // correct from first paint (no hydration gap from useEffect).
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A") {
      const href = node.getAttribute("href") ?? "";
      if (href.startsWith("http://") || href.startsWith("https://")) {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
    }
  });
  const clean = DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });
  DOMPurify.removeHooks("afterSanitizeAttributes");

  return (
    <div
      className={`wiki-content${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
