"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useMemo, useState } from "react";
import { useAuth } from "@/app/auth-context";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ProfileDrawer from "@/components/user-profile/ProfileDrawer";

export default function UserDropdown() {
  const router = useRouter();
  const { user, setUser } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const displayName = useMemo(() => {
    if (!user) return "";
    return user.displayName || user.email;
  }, [user]);


  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      setUser(null);
      router.push("/signin");
    } catch (error) {
      console.error("退出登录失败", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="dropdown-toggle flex items-center text-foreground">
          <span className="mr-3 overflow-hidden rounded-full h-11 w-11">
            <Image
              width={44}
              height={44}
              src="/images/user/owner.jpg"
              alt={displayName || "User"}
            />
          </span>

          <span className="block mr-1 font-medium text-theme-sm">
            {displayName || "未登录"}
          </span>

          <svg
            className="stroke-muted-foreground transition-transform duration-200"
            width="18"
            height="20"
            viewBox="0 0 18 20"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M4.3125 8.65625L9 13.3437L13.6875 8.65625"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="surface-card w-[260px] p-4">
        <div>
          <DropdownMenuLabel className="px-0 pb-0 text-theme-sm font-medium text-foreground">
            {displayName || "访客"}
          </DropdownMenuLabel>
          <p className="text-theme-xs text-muted-foreground">
            {user?.email || "未登录"}
          </p>
        </div>

        <DropdownMenuSeparator className="my-3" />

        <DropdownMenuItem
          className="rounded-lg px-3 py-2 text-theme-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          onSelect={(event) => {
            event.preventDefault();
            setDrawerOpen(true);
          }}
        >
          快速编辑资料
        </DropdownMenuItem>
        <DropdownMenuItem asChild className="rounded-lg px-3 py-2 text-theme-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
          <Link href="/profile">个人资料页</Link>
        </DropdownMenuItem>

        <DropdownMenuSeparator className="my-3" />

        <DropdownMenuItem
          className="flex items-center gap-3 rounded-lg px-3 py-2 text-theme-sm font-medium text-destructive hover:text-destructive"
          onSelect={(event) => {
            event.preventDefault();
            handleLogout();
          }}
        >
          <svg
            className="fill-current"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M15.1007 19.247C14.6865 19.247 14.3507 18.9112 14.3507 18.497L14.3507 14.245H12.8507V18.497C12.8507 19.7396 13.8581 20.747 15.1007 20.747H18.5007C19.7434 20.747 20.7507 19.7396 20.7507 18.497L20.7507 5.49609C20.7507 4.25345 19.7433 3.24609 18.5007 3.24609H15.1007C13.8581 3.24609 12.8507 4.25345 12.8507 5.49609V9.74501L14.3507 9.74501V5.49609C14.3507 5.08188 14.6865 4.74609 15.1007 4.74609L18.5007 4.74609C18.9149 4.74609 19.2507 5.08188 19.2507 5.49609L19.2507 18.497C19.2507 18.9112 18.9149 19.247 18.5007 19.247H15.1007ZM3.25073 11.9984C3.25073 12.2144 3.34204 12.4091 3.48817 12.546L8.09483 17.1556C8.38763 17.4485 8.86251 17.4487 9.15549 17.1559C9.44848 16.8631 9.44863 16.3882 9.15583 16.0952L5.81116 12.7484L16.0007 12.7484C16.4149 12.7484 16.7507 12.4127 16.7507 11.9984C16.7507 11.5842 16.4149 11.2484 16.0007 11.2484L5.81528 11.2484L9.15585 7.90554C9.44864 7.61255 9.44847 7.13767 9.15547 6.84488C8.86248 6.55209 8.3876 6.55226 8.09481 6.84525L3.52309 11.4202C3.35673 11.5577 3.25073 11.7657 3.25073 11.9984Z"
              fill="currentColor"
            />
          </svg>
          退出登录
        </DropdownMenuItem>
      </DropdownMenuContent>

      <ProfileDrawer open={drawerOpen} onOpenChange={setDrawerOpen} />
    </DropdownMenu>
  );
}
