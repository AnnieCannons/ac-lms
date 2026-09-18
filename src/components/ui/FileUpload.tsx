"use client";

import { useRef, useState } from "react";

interface FileUploadProps {
  bucket: string;
  path: string;
  onUpload: (url: string, fileName: string) => void;
  onError?: (msg: string) => void;
  accept?: string;
  maxSizeMB?: number;
  existingUrl?: string;
  /** Allow selecting and uploading more than one file per interaction. Each
   *  uploaded file fires `onUpload` individually; the caller accumulates them. */
  multiple?: boolean;
}

const DEFAULT_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.tar,.gz,image/*";
const DEFAULT_MAX_MB = 10;

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
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(existingUrl ? fileNameFromUrl(existingUrl) : null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(existingUrl ?? null);
  const [error, setError] = useState<string | null>(null);

  const isImage = uploadedName ? /\.(png|jpe?g|gif|webp|svg)$/i.test(uploadedName) : false;

  const uploadOne = async (file: File): Promise<{ ok: true; url: string; name: string } | { ok: false; msg: string }> => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      return { ok: false, msg: `${file.name} exceeds ${maxSizeMB}MB limit` };
    }

    // Sanitize filename: replace spaces with underscores
    const safeName = file.name.replace(/\s+/g, "_");
    const filePath = `${path}${safeName}`;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bucket", bucket);
    formData.append("path", filePath);

    try {
      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const json = await res.json();

      if (!res.ok || json.error) {
        return { ok: false, msg: `${file.name}: ${json.error ?? res.statusText}` };
      }

      return { ok: true, url: json.url, name: safeName };
    } catch {
      return { ok: false, msg: `${file.name}: network error. Please check your connection and try again.` };
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
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
        onUpload(result.url, result.name);
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

  return (
    <div className="flex flex-col gap-1 flex-1">
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
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={handleChange}
          className="hidden"
        />
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
