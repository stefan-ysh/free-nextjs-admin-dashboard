'use client';

import { useState, useRef } from 'react';
import Image from 'next/image';

type ImageUploaderProps = {
  images: string[];
  onChange: (images: string[]) => void;
  label?: string;
  maxImages?: number;
  disabled?: boolean;
};

export default function ImageUploader({
  images,
  onChange,
  label,
  maxImages = 10,
  disabled = false,
}: ImageUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (images.length >= maxImages) {
      alert(`最多只能上传 ${maxImages} 张图片`);
      return;
    }

    const remainingSlots = maxImages - images.length;
    const filesToUpload = Array.from(files).slice(0, remainingSlots);

    setUploading(true);
    try {
      const uploadedUrls: string[] = [];

      for (const file of filesToUpload) {
        // Validate file type
        if (!file.type.startsWith('image/')) {
          alert(`文件 ${file.name} 不是图片格式`);
          continue;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
          alert(`文件 ${file.name} 超过 5MB 限制`);
          continue;
        }

        // For now, convert to base64 data URL
        // In production, you should upload to a file storage service
        const dataUrl = await fileToDataUrl(file);
        uploadedUrls.push(dataUrl);
      }

      onChange([...images, ...uploadedUrls]);
    } catch (error) {
      console.error('上传失败', error);
      alert('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const fileToDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleRemove = (index: number) => {
    const newImages = images.filter((_, i) => i !== index);
    onChange(newImages);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (!disabled) {
      handleFileSelect(e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!disabled) {
      setDragOver(true);
    }
  };

  const handleDragLeave = () => {
    setDragOver(false);
  };

  return (
    <div>
      {label && (
        <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </label>
      )}

      {/* Upload Area */}
      {images.length < maxImages && (
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`relative mb-4 flex min-h-[120px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed transition-colors ${
            dragOver
              ? 'border-brand-500 bg-brand-50 dark:border-brand-400 dark:bg-brand-900/20'
              : 'border-gray-300 bg-gray-50 hover:border-gray-400 hover:bg-gray-100 dark:border-gray-600 dark:bg-gray-800 dark:hover:border-gray-500 dark:hover:bg-gray-700'
          } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          onClick={() => !disabled && !uploading && fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            disabled={disabled || uploading}
            onChange={(e) => handleFileSelect(e.target.files)}
            className="hidden"
          />

          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand-200 border-t-brand-600 dark:border-gray-700 dark:border-t-brand-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">上传中...</span>
            </div>
          ) : (
            <>
              <svg
                className="mb-2 h-12 w-12 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <div className="text-center">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  点击上传或拖拽图片到此处
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  支持 JPG、PNG、GIF，单个文件不超过 5MB
                </p>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  还可上传 {maxImages - images.length} 张
                </p>
              </div>
            </>
          )}
        </div>
      )}

      {/* Image Grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {images.map((url, index) => (
            <div
              key={index}
              className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800"
            >
              <Image
                src={url}
                alt={`图片 ${index + 1}`}
                fill
                className="object-cover"
              />
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemove(index)}
                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-red-500 text-white opacity-0 shadow-lg transition-opacity hover:bg-red-600 group-hover:opacity-100"
                >
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
