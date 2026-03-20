"use client";

import { useCallback, useRef, useState } from "react";
import { MAX_FILE_SIZE_BYTES, MAX_FILE_SIZE_MB } from "@/lib/constants";

interface Props {
  onFileSelect: (file: File) => void;
  disabled?: boolean;
}

export function VideoUploader({ onFileSelect, disabled }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const validateAndSelect = useCallback(
    (file: File) => {
      setError(null);
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setError(`File too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`);
        return;
      }
      if (!file.type.startsWith("video/")) {
        setError("Please select a video file.");
        return;
      }
      onFileSelect(file);
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) validateAndSelect(file);
    },
    [validateAndSelect]
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => !disabled && inputRef.current?.click()}
      className={`
        border-2 border-dashed rounded-xl p-12 text-center cursor-pointer
        transition-colors duration-200
        ${dragOver ? "border-indigo-500 bg-indigo-500/10" : "border-zinc-700 hover:border-zinc-500"}
        ${disabled ? "opacity-50 cursor-not-allowed" : ""}
      `}
    >
      <div className="text-4xl mb-3">🎬</div>
      <p className="text-zinc-400 mb-1">Drop video here or click to browse</p>
      <p className="text-zinc-600 text-sm">
        MP4, MOV, HEVC, WebM &middot; Max {MAX_FILE_SIZE_MB}MB
      </p>
      {error && <p className="text-red-400 text-sm mt-3">{error}</p>}
      <input
        ref={inputRef}
        type="file"
        accept="video/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) validateAndSelect(file);
        }}
        disabled={disabled}
      />
    </div>
  );
}
