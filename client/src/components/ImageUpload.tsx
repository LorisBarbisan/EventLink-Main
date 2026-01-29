import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Image as ImageIcon, Plus, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

interface ImageUploadProps {
  label: string;
  value: string;
  onChange: (imageData: string) => void;
  placeholder?: string;
  maxSizeMB?: number;
  aspectRatio?: "square" | "landscape" | "auto";
  testId?: string;
  shape?: "square" | "circle";
}

export function ImageUpload({
  label,
  value,
  onChange,
  placeholder = "Upload image",
  maxSizeMB = 2,
  aspectRatio = "auto",
  testId = "image-upload",
  shape = "square",
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    if (!file.type.startsWith("image/")) {
      alert("Please select an image file");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // Resize image for optimization
        const maxWidth = 400;
        const maxHeight = 400;
        let { width, height } = img;

        if (width > height) {
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);

        // WebP support with JPEG fallback for better compression
        let compressedData = "";
        if (canvas.toDataURL("image/webp").indexOf("webp") !== -1) {
          compressedData = canvas.toDataURL("image/webp", 0.8);
        } else {
          compressedData = canvas.toDataURL("image/jpeg", 0.8);
        }
        console.log("ImageUpload: Generated compressed data URL, length:", compressedData.length);
        onChange(compressedData);
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files[0]) {
      handleFile(files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files[0]) {
      handleFile(files[0]);
    }
  };

  const removeImage = () => {
    onChange("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {value && value.trim() !== "" && value !== "null" ? (
        <div className={`relative ${shape === "circle" ? "w-fit" : ""}`}>
          <div
            className={`relative overflow-hidden ${
              shape === "circle"
                ? "bg-gradient-primary h-16 w-16 rounded-full border-2 border-muted"
                : "rounded-lg border-2 border-dashed border-muted"
            } ${
              shape === "circle"
                ? ""
                : aspectRatio === "square"
                  ? "aspect-square"
                  : aspectRatio === "landscape"
                    ? "aspect-video"
                    : "max-h-48"
            }`}
          >
            <img
              src={value}
              alt="Uploaded"
              className="h-full w-full object-cover"
              onError={(e) => {
                console.log("ImageUpload: Image failed to load:", value?.substring(0, 50));
                // Hide the image preview if it fails to load
                onChange("");
              }}
              onLoad={() => {
                console.log("ImageUpload: Image loaded successfully");
              }}
            />
          </div>
          <Button
            variant="destructive"
            size="sm"
            className={`absolute ${
              shape === "circle"
                ? "-right-2 -top-2 h-6 w-6 rounded-full p-0 shadow-sm hover:bg-destructive/90"
                : "right-2 top-2"
            }`}
            onClick={removeImage}
            data-testid={`${testId}-remove`}
          >
            <X className={shape === "circle" ? "h-3 w-3" : "h-4 w-4"} />
          </Button>
        </div>
      ) : (
        <div
          className={
            shape === "circle"
              ? "relative w-fit"
              : `rounded-lg border-2 border-dashed border-primary/50 p-12 text-center transition-colors ${
                  isDragging ? "border-primary bg-primary/5" : "hover:border-primary"
                } ${aspectRatio === "square" ? "aspect-square" : "min-h-64"}`
          }
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          data-testid={testId}
        >
          {shape === "circle" ? (
            <>
              <div
                className={`relative flex h-16 w-16 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-primary/50 transition-colors hover:border-primary ${
                  isDragging ? "border-primary bg-primary/5" : ""
                }`}
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <Button
                size="sm"
                className="absolute -right-1 -top-1 h-6 w-6 rounded-full p-0 shadow-sm"
                onClick={(e) => {
                  e.stopPropagation();
                  fileInputRef.current?.click();
                }}
                data-testid={`${testId}-button`}
              >
                <Plus className="h-3 w-3" />
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center space-y-3">
              <ImageIcon className="h-12 w-12 text-muted-foreground" />
              <>
                <p className="text-base font-medium text-muted-foreground">{placeholder}</p>
                <p className="text-sm text-muted-foreground">Drag and drop or click to browse</p>
              </>
              <Button
                variant="outline"
                size="default"
                onClick={() => fileInputRef.current?.click()}
                data-testid={`${testId}-button`}
                className="px-6 py-2"
              >
                <Upload className="mr-2 h-5 w-5" />
                Choose File
              </Button>
            </div>
          )}
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileInput}
        data-testid={`${testId}-input`}
      />

      <p className="text-xs text-muted-foreground">
        Maximum file size: {maxSizeMB}MB. Supported formats: JPG, PNG, GIF
      </p>
    </div>
  );
}
