'use client';

import React from 'react';
import { usePathname } from 'next/navigation';

import { useSidebar } from '@/context/SidebarContext';
import AppHeader from '@/layout/AppHeader';
import AppSidebar from '@/layout/AppSidebar';
import Backdrop from '@/layout/Backdrop';
import { ConfirmProvider } from '@/hooks/useConfirm';

export function AdminLayoutClient({ children }: { children: React.ReactNode }) {
  const { isExpanded, isHovered, isMobileOpen } = useSidebar();
  const pathname = usePathname();

  const edgeToEdgeRoutes = ['/', '/calendar', '/profile'];
  const isEdgeToEdge = edgeToEdgeRoutes.includes(pathname ?? '');

  const mainContentMargin = isMobileOpen
    ? 'ml-0'
    : isExpanded || isHovered
      ? 'lg:ml-[260px]'
      : 'lg:ml-[72px]';

  return (
    <ConfirmProvider>
      <div className="h-screen bg-background text-foreground transition-colors">
        <div className="flex h-full overflow-hidden">
          <AppSidebar />
          <Backdrop />
          <div className={`flex flex-1 flex-col overflow-hidden transition-all duration-300 ease-in-out ${mainContentMargin}`}>
            <AppHeader />
            <div className={`flex-1 overflow-y-auto bg-background/95 transition-colors ${isEdgeToEdge ? 'p-0' : 'p-4 md:p-6'}`}>
              <div className="mx-auto flex h-full w-full max-w-(--breakpoint-2xl) flex-col">
                {children}
              </div>
            </div>
          </div>
        </div>
      </div>
    </ConfirmProvider>
  );
}
