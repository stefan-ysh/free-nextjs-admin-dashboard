'use client';

import Image from 'next/image';
import { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';

const MAX_AVATAR_SIZE = 1_572_864; // 1.5MB

type AvatarUploadProps = {
    initialAvatarUrl?: string | null;
    onAvatarChange: (dataUrl: string | null) => void;
    onAvatarRemove: () => void;
    disabled?: boolean;
};

export default function AvatarUpload({
    initialAvatarUrl,
    onAvatarChange,
    onAvatarRemove,
    disabled = false,
}: AvatarUploadProps) {
    const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl ?? null);
    const [avatarError, setAvatarError] = useState<string | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Sync with initialAvatarUrl if it changes externally (e.g. form reset)
    useEffect(() => {
        setAvatarPreview(initialAvatarUrl ?? null);
    }, [initialAvatarUrl]);

    const handlePickAvatar = () => {
        fileInputRef.current?.click();
    };

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        event.target.value = ''; // Reset input
        if (!file) return;

        if (file.size > MAX_AVATAR_SIZE) {
            setAvatarError('请选择 1.5MB 以下的图片');
            return;
        }

        setAvatarError(null);
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setAvatarPreview(reader.result);
                onAvatarChange(reader.result);
            }
        };
        reader.onerror = () => {
            setAvatarError('读取图片失败，请重试');
        };
        reader.readAsDataURL(file);
    };

    const handleRemove = () => {
        setAvatarPreview(null);
        setAvatarError(null);
        onAvatarRemove();
    };

    return (
        <div className="surface-panel flex items-center gap-4 p-4">
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileChange}
                disabled={disabled}
            />
            <div className="relative h-20 w-20 overflow-hidden rounded-full border border-border">
                <Image
                    src={avatarPreview ?? '/images/user/owner.jpg'}
                    alt="员工头像预览"
                    width={80}
                    height={80}
                    className="object-cover"
                    unoptimized
                />
            </div>
            <div className="flex flex-1 flex-col gap-2 text-sm">
                <div className="font-medium text-foreground">头像</div>
                <p className="text-xs text-muted-foreground">
                    支持 PNG/JPG/GIF，建议 400×400 像素以内，最大 1.5MB。
                </p>
                <div className="flex flex-wrap gap-2">
                    <Button
                        type="button"
                        size="sm"
                        onClick={handlePickAvatar}
                        disabled={disabled}
                    >
                        {avatarPreview ? '更换头像' : '上传头像'}
                    </Button>
                    {avatarPreview && (
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRemove}
                            disabled={disabled}
                        >
                            移除
                        </Button>
                    )}
                </div>
                {avatarError && <p className="text-xs text-destructive">{avatarError}</p>}
            </div>
        </div>
    );
}
