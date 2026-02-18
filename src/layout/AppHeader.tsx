"use client";
import { ThemeToggleButton } from "@/components/common/ThemeToggleButton";
import NotificationDropdown from "@/components/header/NotificationDropdown";
import UserDropdown from "@/components/header/UserDropdown";
import { Button } from "@/components/ui/button";

import { useSidebar } from "@/context/SidebarContext";

import { cn } from "@/lib/utils";
import { PanelLeftOpen, X, PanelLeftClose } from "lucide-react";

import React, { useState, useEffect, useRef } from "react";


const AppHeader: React.FC = () => {
  const [isApplicationMenuOpen] = useState(false);
  const { isExpanded, isMobileOpen, toggleSidebar, toggleMobileSidebar } = useSidebar();

  const handleToggle = () => {
    if (window.innerWidth >= 1024) {
      toggleSidebar();
    } else {
      toggleMobileSidebar();
    }
  };
  const inputRef = useRef<HTMLInputElement>(null);




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
    <header className="sticky top-0 z-40 flex w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/85 px-4">
      <div className="flex w-full items-center justify-between gap-2 border-b border-border px-3 py-3 sm:gap-4 lg:justify-normal lg:border-b-0 lg:px-0 lg:py-2">
        <Button
          variant="outline"
          size="icon"
          className="z-40 h-10 w-10 border-border text-muted-foreground sm:h-11 sm:w-11"
          onClick={handleToggle}
          aria-label="Toggle Sidebar"
        >
          {isMobileOpen ? <X className="h-4 w-4" /> : isExpanded ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </Button>
      </div>
      <div
        className={cn(
          "w-full items-center justify-between gap-4 px-5 py-2 lg:flex lg:justify-end lg:px-0",
          isApplicationMenuOpen ? "flex border-t border-border bg-background" : "hidden lg:flex"
        )}
      >
        <div className="flex flex-wrap items-center gap-2 2xsm:gap-3">

          {/* <!-- Dark Mode Toggler --> */}
          <ThemeToggleButton />
          {/* <!-- Dark Mode Toggler --> */}

          <NotificationDropdown />
          {/* <!-- Notification Menu Area --> */}
        </div>
        {/* <!-- User Area --> */}
        <UserDropdown />

      </div>
    </header>
  );
};

export default AppHeader;
