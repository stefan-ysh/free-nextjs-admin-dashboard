'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Loader2, X, ImagePlus } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface ImageUploadProps {
    value?: string;
    onChange: (url: string | undefined) => void;
    folder?: string;
    className?: string;
    disabled?: boolean;
}

export default function ImageUpload({
    value,
    onChange,
    folder = 'inventory',
    className,
    disabled
}: ImageUploadProps) {
    const [uploading, setUploading] = useState(false);

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            toast.error('图片大小不能超过 5MB');
            return;
        }

        setUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        formData.append('folder', folder);

        try {
            const res = await fetch('/api/files/upload', {
                method: 'POST',
                body: formData,
            });
            const json = await res.json();

            if (!res.ok) {
                throw new Error(json.error || '上传失败');
            }

            onChange(json.data.url);
            toast.success('上传成功');
        } catch (error) {
            console.error('Upload error:', error);
            toast.error(error instanceof Error ? error.message : '上传失败');
        } finally {
            setUploading(false);
            // Reset input
            e.target.value = '';
        }
    };

    const handleRemove = () => {
        onChange(undefined);
    };

    return (
        <div className={cn('relative flex flex-col gap-4', className)}>
            <div className="group relative flex h-40 w-40 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted transition-colors hover:bg-accent">
                {value ? (
                    <>
                        <div className="relative h-full w-full overflow-hidden rounded-xl">
                            <Image
                                src={value}
                                alt="Uploaded image"
                                fill
                                className="object-cover"
                                unoptimized // Use unoptimized for user uploaded content if domain not allowed
                            />
                        </div>
                        {!disabled && (
                            <div className="absolute -right-2 -top-2 z-10">
                                <Button
                                    type="button"
                                    variant="destructive"
                                    size="icon"
                                    className="h-6 w-6 rounded-full shadow-md"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleRemove();
                                    }}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </div>
                        )}
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                            <p className="text-xs font-medium text-white">点击更换</p>
                        </div>
                    </>
                ) : (
                    <div className="flex flex-col items-center justify-center p-4 text-center ">
                        {uploading ? (
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        ) : (
                            <ImagePlus className="h-8 w-8 text-muted-foreground" />
                        )}
                        <p className="mt-2 text-xs text-muted-foreground">
                            {uploading ? '上传中...' : '上传图片'}
                        </p>
                        <p className="mt-1 text-[10px] text-muted-foreground/70">最大 5MB</p>
                    </div>
                )}
                <input
                    type="file"
                    accept="image/*"
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                    onChange={handleUpload}
                    disabled={disabled || uploading}
                />
            </div>
        </div>
    );
}
