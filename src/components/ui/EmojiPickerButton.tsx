"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import EmojiPicker, { EmojiStyle, type EmojiClickData } from "emoji-picker-react";

const PICKER_WIDTH = 300;
const PICKER_HEIGHT = 360;

export default function EmojiPickerButton({
  onEmojiSelect,
  label = "Insert emoji",
  className,
}: {
  onEmojiSelect: (emoji: string) => void;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  const updatePosition = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const left = Math.min(rect.left, window.innerWidth - PICKER_WIDTH - 8);
    const openUpward = rect.bottom + PICKER_HEIGHT + 8 > window.innerHeight;
    const top = openUpward ? rect.top - PICKER_HEIGHT - 4 : rect.bottom + 4;
    setPosition({ top: Math.max(8, top), left: Math.max(8, left) });
  };

  useLayoutEffect(() => {
    if (open) updatePosition();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        popoverRef.current?.contains(e.target as Node)
      ) {
        return;
      }
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onReposition() {
      updatePosition();
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          setOpen((o) => !o);
        }}
        aria-label={label}
        aria-expanded={open}
        title={label}
        className={
          className ??
          "px-2 py-1 rounded text-xs font-medium text-muted-text hover:bg-border/40 hover:text-dark-text transition-colors"
        }
      >
        🙂
      </button>
      {open &&
        position &&
        createPortal(
          <div
            ref={popoverRef}
            className="fixed z-50 shadow-lg rounded-xl"
            style={{ top: position.top, left: position.left }}
          >
            <EmojiPicker
              onEmojiClick={(data: EmojiClickData) => {
                onEmojiSelect(data.emoji);
                setOpen(false);
              }}
              emojiStyle={EmojiStyle.NATIVE}
              autoFocusSearch={false}
              width={PICKER_WIDTH}
              height={PICKER_HEIGHT}
            />
          </div>,
          document.body
        )}
    </>
  );
}
