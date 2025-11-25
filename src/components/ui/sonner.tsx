"use client";

import { Toaster as SonnerToaster, toast as sonnerToast } from 'sonner';
import type { ComponentProps } from 'react';

export type ToasterProps = ComponentProps<typeof SonnerToaster>;

export const Toaster = (props: ToasterProps) => {
  return <SonnerToaster position="top-center" richColors closeButton duration={4000} expand {...props} />;
};

export const toast = sonnerToast;
