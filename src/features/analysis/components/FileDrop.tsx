"use client";

import { useState } from "react";
import { UploadIcon } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";

const ACCEPT = ".pdf,.docx,.txt,.md";

/** Drag-and-drop or click-to-pick file area with a removable file list. */
export function FileDrop({
  label,
  hint,
  files,
  multiple,
  tall,
  onFiles,
  onRemove,
}: {
  label: string;
  hint: string;
  files: File[];
  multiple?: boolean;
  tall?: boolean;
  onFiles: (files: File[]) => void;
  onRemove: (index: number) => void;
}) {
  const [dragging, setDragging] = useState(false);
  return (
    <div className="grid gap-2">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onFiles([...e.dataTransfer.files]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed px-4 text-center transition-colors",
          "hover:border-primary/60 hover:bg-primary-soft/30 has-[:focus-visible]:border-primary",
          tall ? "min-h-[14rem]" : "py-5",
          dragging ? "border-primary bg-primary-soft/50" : "border-border",
        )}
      >
        <UploadIcon className="mb-1 size-6 text-primary" />
        <span className="font-medium">{label}</span>
        <span className="text-sm text-muted-foreground">
          <span className="hidden sm:inline">Drag and drop or click. </span>
          {hint}
        </span>
        <input
          type="file"
          accept={ACCEPT}
          multiple={multiple}
          className="sr-only"
          onChange={(e) => {
            onFiles([...(e.target.files ?? [])]);
            e.target.value = "";
          }}
        />
      </label>
      {files.length > 0 && (
        <ul className="grid gap-1 text-sm">
          {files.map((f, i) => (
            <li key={`${f.name}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-muted px-3 py-2">
              <span className="truncate">{f.name}</span>
              <button type="button" onClick={() => onRemove(i)} className="shrink-0 text-muted-foreground hover:text-danger">
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
