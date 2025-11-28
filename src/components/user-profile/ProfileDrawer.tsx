"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { UserCircle, Settings } from "lucide-react";
import { useAuth } from "@/app/auth-context";
import { Button } from "@/components/ui/button";
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from "@/components/ui/sheet";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/components/ui/sonner";
import type { ProfileData } from "./types";

type ApiResponse<T> = {
    success: boolean;
    data?: T;
    error?: string;
};

type ProfileDrawerProps = {
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export default function ProfileDrawer({ open, onOpenChange }: ProfileDrawerProps) {
    const { user, refresh } = useAuth();
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    // Form state for quick edit
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [phone, setPhone] = useState("");

    // Load profile when drawer opens
    const loadProfile = useCallback(async () => {
        if (!open) return;

        setLoading(true);
        try {
            const res = await fetch("/api/profile", { cache: "no-store" });
            const json = await res.json() as ApiResponse<ProfileData>;

            if (!res.ok || !json.success || !json.data) {
                throw new Error(json.error ?? "加载资料失败");
            }

            setProfile(json.data);
            setFirstName(json.data.firstName ?? "");
            setLastName(json.data.lastName ?? "");
            setPhone(json.data.phone ?? "");
        } catch (err) {
            console.error(err);
            toast.error("加载资料失败");
        } finally {
            setLoading(false);
        }
    }, [open]);

    // Load profile when drawer opens
    useState(() => {
        if (open) {
            loadProfile();
        }
    });

    const handleSave = async () => {
        if (!profile) return;

        setSaving(true);
        try {
            const payload = {
                ...profile,
                firstName: firstName.trim() || null,
                lastName: lastName.trim() || null,
                phone: phone.trim() || null,
            };

            const res = await fetch("/api/profile", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            const json = await res.json() as ApiResponse<ProfileData>;

            if (!res.ok || !json.success) {
                throw new Error(json.error ?? "保存失败");
            }

            toast.success("资料已更新");
            await refresh();
            onOpenChange(false);
        } catch (err) {
            console.error(err);
            toast.error(err instanceof Error ? err.message : "保存失败");
        } finally {
            setSaving(false);
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-lg">
                <SheetHeader>
                    <SheetTitle>个人资料</SheetTitle>
                    <SheetDescription>快速编辑基本信息</SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                    {/* Avatar */}
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
                            <AvatarImage src={user?.avatarUrl ?? undefined} alt={user?.displayName ?? "User"} />
                            <AvatarFallback>
                                <UserCircle className="h-8 w-8" />
                            </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                            <p className="text-sm font-medium">{user?.displayName}</p>
                            <p className="text-xs text-muted-foreground">{user?.email}</p>
                        </div>
                    </div>

                    {loading ? (
                        <div className="py-8 text-center text-sm text-muted-foreground">加载中...</div>
                    ) : (
                        <div className="space-y-4">
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="firstName">名</Label>
                                    <Input
                                        id="firstName"
                                        value={firstName}
                                        onChange={(e) => setFirstName(e.target.value)}
                                        placeholder="请输入名"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="lastName">姓</Label>
                                    <Input
                                        id="lastName"
                                        value={lastName}
                                        onChange={(e) => setLastName(e.target.value)}
                                        placeholder="请输入姓"
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="phone">电话</Label>
                                <Input
                                    id="phone"
                                    type="tel"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="请输入电话号码"
                                />
                            </div>

                            {/* Link to full profile */}
                            <div className="rounded-lg border border-border bg-muted/50 p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">完整资料</p>
                                        <p className="text-xs text-muted-foreground">
                                            编辑更多信息，如地址、密码等
                                        </p>
                                    </div>
                                    <Button variant="ghost" size="sm" asChild>
                                        <Link href="/profile">
                                            <Settings className="mr-2 h-4 w-4" />
                                            前往
                                        </Link>
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                    <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                        取消
                    </Button>
                    <Button onClick={handleSave} disabled={loading || saving}>
                        {saving ? "保存中..." : "保存"}
                    </Button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
