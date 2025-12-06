"use client";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import UserDropdown from "@/components/header/UserDropdown";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSidebar } from "@/context/SidebarContext";
import { useAuth } from "@/app/auth-context";
import { cn } from "@/lib/utils";
import { Loader2, Menu, MoreHorizontal, Search, X, Plus, DollarSign, Users } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import Image from "next/image";
import Link from "next/link";
import React, { useState, useEffect, useRef } from "react";
import { usePermissions } from "@/hooks/usePermissions";

const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen, setApplicationMenuOpen] = useState(false);
  const { loading } = useAuth();
  const { hasPermission } = usePermissions();

  const { isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };

  const toggleApplicationMenu = () => {
    setApplicationMenuOpen(!isApplicationMenuOpen);
  };
  const inputRef = useRef<HTMLInputElement>(null);

  const canCreateFinanceRecord = hasPermission('FINANCE_MANAGE');
  const canCreateEmployee = hasPermission('USER_CREATE');
  const hasQuickActions = canCreateFinanceRecord || canCreateEmployee;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "k") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 flex w-full border-gray-200 bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 dark:border-gray-800 dark:bg-gray-900/90 lg:border-b">
      <div className="flex grow flex-col items-center justify-between lg:flex-row lg:px-6">
        <div className="flex w-full items-center justify-between gap-2 border-b border-gray-200 px-3 py-3 dark:border-gray-800 sm:gap-4 lg:justify-normal lg:border-b-0 lg:px-0 lg:py-2">
          <Button
            variant="outline"
            size="icon"
            className="z-40 h-11 w-11 border-gray-200 text-gray-500 dark:border-gray-800 dark:text-gray-300"
            onClick={handleToggle}
            aria-label="Toggle Sidebar"
          >
            {isMobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>

          <Link href="/" className="lg:hidden">
            <Image
              width={154}
              height={32}
              className="dark:hidden"
              src="/images/logo/logo.svg"
              alt="Logo"
            />
            <Image
              width={154}
              height={32}
              className="hidden dark:block"
              src="/images/logo/logo.svg"
              alt="Logo"
            />
          </Link>

          <Button
            onClick={toggleApplicationMenu}
            variant="ghost"
            size="icon"
            className="z-40 text-gray-700 hover:bg-muted dark:text-gray-300 lg:hidden"
            aria-label="Toggle header actions"
          >
            <MoreHorizontal className="h-5 w-5" />
          </Button>
        </div>
        <div
          className={cn(
            "w-full items-center justify-between gap-4 px-5 py-2 lg:flex lg:justify-end lg:px-0",
            isApplicationMenuOpen ? "flex shadow-theme-md" : "hidden lg:flex"
          )}
        >
          <div className="flex items-center gap-2 2xsm:gap-3">
            {/* <!-- Quick Create Menu --> */}
            {hasQuickActions && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="default"
                    size="icon"
                    className="h-9 w-9"
                    aria-label="Quick Create"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>快速创建</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {canCreateFinanceRecord && (
                    <DropdownMenuItem asChild>
                      <Link href="/finance?action=new" className="flex items-center gap-2 cursor-pointer">
                        <DollarSign className="h-4 w-4" />
                        <span>记一笔</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                  {canCreateEmployee && (
                    <DropdownMenuItem asChild>
                      <Link href="/employees?action=new" className="flex items-center gap-2 cursor-pointer">
                        <Users className="h-4 w-4" />
                        <span>新增员工</span>
                      </Link>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {/* <!-- Dark Mode Toggler --> */}
            <ThemeToggleButton />
            {/* <!-- Dark Mode Toggler --> */}

            <NotificationDropdown />
            {/* <!-- Notification Menu Area --> */}
          </div>
          {/* <!-- User Area --> */}
          <UserDropdown />

        </div>
      </div>
    </header>
  );
};

export default AppHeader;
