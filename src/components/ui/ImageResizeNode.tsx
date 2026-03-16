"use client";

import { NodeViewWrapper, ReactNodeViewProps } from "@tiptap/react";
import { useRef } from "react";

export default function ImageResizeNode({ node, updateAttributes, selected }: ReactNodeViewProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;
    startWidth.current = imgRef.current?.offsetWidth ?? (node.attrs.width ?? 400);

    const onMove = (e: MouseEvent) => {
      const newWidth = Math.max(80, startWidth.current + (e.clientX - startX.current));
      updateAttributes({ width: Math.round(newWidth) });
    };

    const onUp = () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  };

  const width = node.attrs.width as number | null | undefined;

  return (
    <NodeViewWrapper
      className="relative inline-block max-w-full"
      style={{ width: width ? `${width}px` : "auto" }}
    >
      <img
        ref={imgRef}
        src={node.attrs.src}
        alt={node.attrs.alt ?? ""}
        className="block max-w-full rounded"
        style={{ width: width ? `${width}px` : "auto" }}
        draggable={false}
      />
      {selected && (
        <>
          {/* Selection outline */}
          <div className="absolute inset-0 border-2 border-teal-primary rounded pointer-events-none" />
          {/* Resize handle */}
          <div
            className="absolute bottom-0 right-0 w-4 h-4 bg-teal-primary rounded-tl-md cursor-se-resize"
            onMouseDown={onMouseDown}
            title="Drag to resize"
          />
        </>
      )}
    </NodeViewWrapper>
  );
}
