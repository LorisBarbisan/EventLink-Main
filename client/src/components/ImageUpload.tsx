import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Upload, X, Image as ImageIcon } from 'lucide-react';

interface ImageUploadProps {
  label: string;
  value: string;
  onChange: (imageData: string) => void;
  placeholder?: string;
  maxSizeMB?: number;
  aspectRatio?: 'square' | 'landscape' | 'auto';
  testId?: string;
  shape?: 'square' | 'circle';
}

export function ImageUpload({
  label,
  value,
  onChange,
  placeholder = "Upload image",
  maxSizeMB = 2,
  aspectRatio = 'auto',
  testId = 'image-upload',
  shape = 'square'
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`File size must be less than ${maxSizeMB}MB`);
      return;
    }

    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
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
        
        const compressedData = canvas.toDataURL('image/jpeg', 0.8);
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
    onChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      
      {value ? (
        <div className="relative">
          <div className={`relative overflow-hidden ${
            shape === 'circle' ? 'rounded-full w-32 h-32 bg-gradient-primary border-2 border-muted' : 
            'rounded-lg border-2 border-dashed border-muted'
          } ${
            shape === 'circle' ? '' :
            aspectRatio === 'square' ? 'aspect-square' : 
            aspectRatio === 'landscape' ? 'aspect-video' : 'max-h-48'
          }`}>
            <img 
              src={value} 
              alt="Uploaded" 
              className="w-full h-full object-cover"
            />
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={removeImage}
              data-testid={`${testId}-remove`}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <div
          className={`border-2 border-dashed border-muted text-center transition-colors ${
            shape === 'circle' ? 'rounded-full w-32 h-32 flex items-center justify-center' : 
            'rounded-lg p-12'
          } ${
            isDragging ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
          } ${
            shape === 'circle' ? '' :
            aspectRatio === 'square' ? 'aspect-square' : 'min-h-64'
          }`}
          onDrop={handleDrop}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          data-testid={testId}
        >
          <div className={`flex flex-col items-center justify-center ${shape === 'circle' ? 'space-y-1' : 'space-y-3'}`}>
            <ImageIcon className={`${shape === 'circle' ? 'w-8 h-8' : 'w-12 h-12'} text-muted-foreground`} />
            {shape !== 'circle' && (
              <>
                <p className="text-base text-muted-foreground font-medium">{placeholder}</p>
                <p className="text-sm text-muted-foreground">
                  Drag and drop or click to browse
                </p>
              </>
            )}
            <Button
              variant="outline"
              size={shape === 'circle' ? 'sm' : 'default'}
              onClick={() => fileInputRef.current?.click()}
              data-testid={`${testId}-button`}
              className={shape === 'circle' ? 'text-xs px-2 py-1' : 'px-6 py-2'}
            >
              <Upload className={`${shape === 'circle' ? 'w-3 h-3 mr-1' : 'w-5 h-5 mr-2'}`} />
              {shape === 'circle' ? 'Add' : 'Choose File'}
            </Button>
          </div>
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