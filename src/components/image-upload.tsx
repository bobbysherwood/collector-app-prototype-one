"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ImageUploadProps {
  currentImageUrl?: string | null;
  onFileSelect: (file: File | null) => void;
}

export function ImageUpload({ currentImageUrl, onFileSelect }: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentImageUrl ?? null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0] ?? null;
    if (file) {
      setPreview(URL.createObjectURL(file));
      onFileSelect(file);
    }
  }

  function handleRemove() {
    setPreview(null);
    onFileSelect(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-3">
      {preview ? (
        <div className="relative aspect-[2.5/3.5] w-full max-w-[240px] overflow-hidden rounded-lg border border-border bg-muted">
          <Image
            src={preview}
            alt="Card preview"
            fill
            className="object-contain"
            unoptimized
          />
          <Button
            type="button"
            variant="destructive"
            size="icon-xs"
            className="absolute top-2 right-2"
            onClick={handleRemove}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex aspect-[2.5/3.5] w-full max-w-[240px] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/30 text-muted-foreground transition-colors hover:border-primary/50 hover:bg-muted/50"
        >
          <Upload className="h-8 w-8" />
          <span className="text-sm">Upload card image</span>
          <span className="text-xs">JPG, PNG, WebP</span>
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}
