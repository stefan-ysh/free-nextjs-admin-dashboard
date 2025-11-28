'use client';

import { useState } from 'react';
import { toast } from 'sonner';

import FilePreviewDialog from '@/components/common/FilePreviewDialog';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB，与服务端限制保持一致
const UPLOAD_ENDPOINT = '/api/files/upload';
const DEFAULT_FOLDER = 'finance/attachments';
const DEFAULT_PREFIX = 'invoice';

function extractFileLabel(pathValue: string, index: number): string {
  if (!pathValue) return `发票附件 ${index + 1}`;
  try {
    const decoded = decodeURIComponent(pathValue);
    const segments = decoded.split('/').filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    return lastSegment || `发票附件 ${index + 1}`;
  } catch (error) {
    console.warn('解析文件名失败:', error);
    return `发票附件 ${index + 1}`;
  }
}

type UploadResponse = {
  success: boolean;
  data?: {
    url: string;
    name: string;
    size: number;
    type: string;
  };
  error?: string;
};

interface FileUploadProps {
  files: string[];
  onChange: (files: string[]) => void;
  maxFiles?: number;
  accept?: string;
}

export default function FileUpload({
  files,
  onChange,
  maxFiles = 5,
  accept = 'image/*,.pdf'
}: FileUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<{ url: string; label: string } | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const selectedFiles = input.files;
    if (!selectedFiles || selectedFiles.length === 0) {
      input.value = '';
      return;
    }

    if (files.length + selectedFiles.length > maxFiles) {
      toast.warning(`最多只能上传 ${maxFiles} 个文件`);
      input.value = '';
      return;
    }

    setUploading(true);

    try {
      const uploadedPaths: string[] = [];

      for (const file of Array.from(selectedFiles)) {
        if (file.size > MAX_FILE_SIZE) {
          toast.warning(`${file.name} 超过 5MB 限制，已跳过`);
          continue;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', DEFAULT_FOLDER);
        formData.append('prefix', DEFAULT_PREFIX);

        const response = await fetch(UPLOAD_ENDPOINT, {
          method: 'POST',
          body: formData,
        });

        const result = (await response.json()) as UploadResponse;
        if (!response.ok || !result.success || !result.data) {
          const message = result.error ?? '上传失败,请重试';
          throw new Error(message);
        }

        uploadedPaths.push(result.data.url);
      }

      if (uploadedPaths.length) {
        onChange([...files, ...uploadedPaths]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error instanceof Error ? error.message : '上传失败,请重试');
    } finally {
      setUploading(false);
      input.value = '';
    }
  };

  const handleRemove = (index: number) => {
    const newFiles = files.filter((_, i) => i !== index);
    onChange(newFiles);
  };

  return (
    <div className="space-y-3">
      {/* 文件列表 */}
      {files.length > 0 && (
        <div className="space-y-2">
          {files.map((file, index) => {
            const label = extractFileLabel(file, index);
            return (
              <div
                key={`${file}-${index}`}
                className="flex items-center justify-between rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-600 dark:bg-gray-700"
              >
                <div className="flex items-center gap-3">
                  <svg
                    className="h-5 w-5 text-gray-500 dark:text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <span className="text-sm text-gray-700 dark:text-gray-300">{label}</span>
                </div>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPreviewTarget({ url: file, label })}
                    className="text-sm text-primary hover:underline"
                    disabled={uploading}
                  >
                    预览
                  </button>
                  <button
                    type="button"
                    onClick={() => handleRemove(index)}
                    className="text-red-600 hover:text-red-700 dark:text-red-400"
                    disabled={uploading}
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 上传按钮 */}
      {files.length < maxFiles && (
        <label className="flex cursor-pointer items-center justify-center rounded-lg border-2 border-dashed border-gray-300 bg-white px-4 py-3 text-sm transition-colors hover:border-gray-400 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:border-gray-500 dark:hover:bg-gray-600">
          <input
            type="file"
            multiple
            accept={accept}
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
          <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
            {uploading ? (
              <>
                <svg
                  className="h-5 w-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                <span>上传中...</span>
              </>
            ) : (
              <>
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span>
                  点击上传发票 ({files.length}/{maxFiles})
                </span>
              </>
            )}
          </div>
        </label>
      )}

      <p className="text-xs text-gray-500 dark:text-gray-400">
        支持 JPG、PNG、PDF 格式,单个文件不超过 5MB
      </p>
      <FilePreviewDialog
        open={Boolean(previewTarget)}
        fileUrl={previewTarget?.url ?? null}
        fileLabel={previewTarget?.label}
        onClose={() => setPreviewTarget(null)}
      />
    </div>
  );
}
