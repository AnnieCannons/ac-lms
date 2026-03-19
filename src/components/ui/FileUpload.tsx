"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface FileUploadProps {
  bucket: string;
  path: string;
  onUpload: (url: string, fileName: string) => void;
  onError?: (msg: string) => void;
  accept?: string;
  maxSizeMB?: number;
}

const DEFAULT_ACCEPT = ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.zip,.tar,.gz,image/*";
const DEFAULT_MAX_MB = 10;

export default function FileUpload({
  bucket,
  path,
  onUpload,
  onError,
  accept = DEFAULT_ACCEPT,
  maxSizeMB = DEFAULT_MAX_MB,
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedName, setUploadedName] = useState<string | null>(null);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isImage = uploadedName ? /\.(png|jpe?g|gif|webp|svg)$/i.test(uploadedName) : false;

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setUploadedName(null);

    if (file.size > maxSizeMB * 1024 * 1024) {
      const msg = `File exceeds ${maxSizeMB}MB limit`;
      setError(msg);
      onError?.(msg);
      return;
    }

    setUploading(true);
    const supabase = createClient();
    // Sanitize filename: replace spaces with underscores
    const safeName = file.name.replace(/\s+/g, "_");
    const filePath = `${path}${safeName}`;

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      const msg = `Upload failed: ${uploadError.message}`;
      setError(msg);
      onError?.(msg);
      setUploading(false);
      return;
    }

    const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
    setUploadedName(safeName);
    setUploadedUrl(data.publicUrl);
    setUploading(false);
    onUpload(data.publicUrl, safeName);

    // Reset input so same file can be re-selected if needed
    if (inputRef.current) inputRef.current.value = "";
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
          {uploading ? "Uploading…" : "Choose file"}
        </button>
        {uploadedName && uploadedUrl ? (
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
          onChange={handleChange}
          className="hidden"
        />
      </div>
      {isImage && uploadedUrl && (
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
