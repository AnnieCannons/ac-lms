"use client";

import { useRef, useState } from "react";
import { uploadFile } from "@/lib/upload-file";

interface FileUploadProps {
  bucket: string;
  path: string;
  /** `path` is the storage path — what private-bucket callers should store. */
  onUpload: (url: string, fileName: string, path: string) => void;
  onError?: (msg: string) => void;
  accept?: string;
  maxSizeMB?: number;
  existingUrl?: string;
  /** Allow selecting and uploading more than one file per interaction. Each
   *  uploaded file fires `onUpload` individually; the caller accumulates them. */
  multiple?: boolean;
  /** Show a larger drag-and-drop area instead of the compact button row. Files can
   *  be dropped on either layout. */
  dropzone?: boolean;
}

const DEFAULT_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.tar,.gz,image/*";
const DEFAULT_MAX_MB = 10;

/** Does `file` match an <input accept> list (".pdf", "image/*", "text/plain")? */
function matchesAccept(file: File, accept: string): boolean {
  const name = file.name.toLowerCase();
  const type = file.type.toLowerCase();
  return accept.split(",").map(a => a.trim().toLowerCase()).filter(Boolean).some(a =>
    a.startsWith(".") ? name.endsWith(a)
      : a.endsWith("/*") ? type.startsWith(a.slice(0, -1))
      : type === a
  );
}

const fileNameFromUrl = (url: string) => {
  try {
    return decodeURIComponent(new URL(url).pathname.split("/").pop() || url);
  } catch {
    return url;
  }
};

export default function FileUpload({
  bucket,
  path,
  onUpload,
  onError,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = DEFAULT_MAX_MB,
  existingUrl,
  multiple = false,
  dropzone = false,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(existingUrl ? fileNameFromUrl(existingUrl) : null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(existingUrl ?? null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  // dragenter/dragleave fire for every child element; count them so the
  // highlight doesn't flicker as the pointer crosses the button or text.
  const dragDepth = useRef(0);

  const isImage = uploadedName ? /\.(png|jpe?g|gif|webp|svg)$/i.test(uploadedName) : false;

  const uploadOne = async (file: File): Promise<{ ok: true; url: string; path: string; name: string } | { ok: false; msg: string }> => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return { ok: false, msg: `${file.name} exceeds ${maxSizeMB}MB limit` };
    }

    // Sanitize filename: replace spaces with underscores
    const safeName = file.name.replace(/\s+/g, "_");
    const filePath = `${path}${safeName}`;

    const result = await uploadFile(file, bucket, filePath);
    if (!result.ok) return { ok: false, msg: `${file.name}: ${result.error}` };
    return { ok: true, url: result.url, path: result.path, name: safeName };
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    await uploadFiles(Array.from(e.target.files ?? []));
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;

    setError(null);
    if (!multiple) setUploadedName(null);
    setUploading(true);

    const errors: string[] = [];
    for (const file of files) {
      const result = await uploadOne(file);
      if (result.ok) {
        setUploadedName(result.name);
        setUploadedUrl(result.url);
        onUpload(result.url, result.name, result.path);
      } else {
        errors.push(result.msg);
      }
    }

    if (errors.length > 0) {
      const msg = errors.join("; ");
      setError(msg);
      onError?.(msg);
    }

    // Reset input so the same file(s) can be re-selected if needed
    if (inputRef.current) inputRef.current.value = "";
    setUploading(false);
  };

  const isFileDrag = (e: React.DragEvent) => e.dataTransfer.types.includes("Files");

  const dropHandlers = {
    onDragEnter: (e: React.DragEvent) => {
      if (!isFileDrag(e) || uploading) return;
      e.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver: (e: React.DragEvent) => {
      if (!isFileDrag(e) || uploading) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop: (e: React.DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      if (uploading) return;
      let files = Array.from(e.dataTransfer.files);
      if (!multiple) files = files.slice(0, 1);
      const rejected = files.filter(f => !matchesAccept(f, accept));
      const accepted = files.filter(f => matchesAccept(f, accept));
      if (rejected.length > 0) {
        const msg = `${rejected.map(f => f.name).join(", ")}: file type not allowed`;
        setError(msg);
        onError?.(msg);
      }
      void uploadFiles(accepted);
    },
  };

  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      multiple={multiple}
      onChange={handleChange}
      className="hidden"
    />
  );

  if (dropzone) {
    return (
      <div className="flex flex-col gap-1 flex-1">
        <div
          {...dropHandlers}
          className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-6 text-center transition-colors ${
            dragging ? "border-teal-primary bg-teal-light" : "border-border bg-background"
          }`}
        >
          <p className="text-sm text-dark-text">
            {uploading ? "Uploading…" : dragging ? "Drop to upload" : multiple ? "Drag files here, or" : "Drag a file here, or"}
          </p>
          {!uploading && !dragging && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="bg-surface border border-border rounded px-3 py-1.5 text-xs text-dark-text hover:border-teal-primary hover:text-teal-primary transition-colors whitespace-nowrap"
            >
              {multiple ? "Choose file(s)" : "Choose file"}
            </button>
          )}
          <p className="text-xs text-muted-text">Images or files{multiple ? ", one or more" : ""} · up to {maxSizeMB}MB each</p>
          {input}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    );
  }

  return (
    <div {...dropHandlers} className={`flex flex-col gap-1 flex-1 rounded ${dragging ? "ring-2 ring-teal-primary" : ""}`}>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="bg-background border border-border rounded px-3 py-1.5 text-xs text-dark-text hover:border-teal-primary hover:text-teal-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
        >
          {uploading ? "Uploading…" : multiple ? "Add file(s)" : "Choose file"}
        </button>
        {multiple ? (
          !uploading && <span className="text-xs text-muted-text truncate">Images or files, one or more</span>
        ) : uploadedName && uploadedUrl ? (
          <a
            href={uploadedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-teal-primary truncate hover:underline"
          >
            {uploadedName}
          </a>
        ) : !uploading && (
          <span className="text-xs text-muted-text truncate">No file chosen</span>
        )}
        {input}
      </div>
      {!multiple && isImage && uploadedUrl && (
        <a href={uploadedUrl} target="_blank" rel="noopener noreferrer">
          <img
            src={uploadedUrl}
            alt={uploadedName ?? "preview"}
            className="mt-1 h-20 w-auto rounded border border-border object-contain"
          />
        </a>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
