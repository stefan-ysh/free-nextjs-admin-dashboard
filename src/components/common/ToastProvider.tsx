'use client';

import { Toaster } from '@/components/ui/sonner';

export default function ToastProvider() {
  return (
    <Toaster
      position="top-center"
      richColors
      toastOptions={{
        classNames: {
          toast: 'text-sm font-medium',
        },
        duration: 4000,
      }}
    />
  );
}
