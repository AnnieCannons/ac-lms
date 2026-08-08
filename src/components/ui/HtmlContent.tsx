"use client";

import DOMPurify from "isomorphic-dompurify";

// Force all links to open in a new tab during sanitization so it's correct from
// first paint (no hydration gap from useEffect). Registered once at module scope —
// adding/removing this hook per render raced with concurrent sanitize() calls from
// other components using the same global DOMPurify instance.
DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    const href = node.getAttribute("href") ?? "";
    if (href.startsWith("http://") || href.startsWith("https://")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  }
});

export default function HtmlContent({
  html,
  className,
}: {
  html: string;
  className?: string;
}) {
  const clean = DOMPurify.sanitize(html, { ADD_ATTR: ["target"] });

  return (
    <div
      className={`wiki-content${className ? ` ${className}` : ''}`}
      dangerouslySetInnerHTML={{ __html: clean }}
    />
  );
}
