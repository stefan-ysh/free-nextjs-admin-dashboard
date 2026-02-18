"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { UserCircle, Settings } from "lucide-react";
import { useAuth } from "@/app/auth-context";
import { Button } from "@/components/ui/button";
import {
    Drawer,
    DrawerBody,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerHeader,
    DrawerTitle,
    DrawerFooter,
} from "@/components/ui/drawer";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
    const [displayName, setDisplayName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");

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
            setDisplayName(json.data.displayName ?? "");
            setPhone(json.data.phone ?? "");
            setAddress(json.data.address ?? "");
        } catch (err) {
            console.error(err);
            toast.error("加载资料失败");
        } finally {
            setLoading(false);
        }
    }, [open]);

    useEffect(() => {
        if (!open) return;
        loadProfile();
    }, [open, loadProfile]);

    const handleSave = async () => {
        if (!profile) return;

        setSaving(true);
        try {
            const payload = {
                ...profile,
                displayName: displayName.trim() || null,
                phone: phone.trim() || null,
                address: address.trim() || null,
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
        <Drawer open={open} onOpenChange={onOpenChange} direction="right">
            <DrawerContent side="right" className="w-full sm:max-w-lg">
                <DrawerHeader className="border-b border-border/60 pb-4">
                    <DrawerTitle>个人资料</DrawerTitle>
                    <DrawerDescription>快速编辑基本信息</DrawerDescription>
                </DrawerHeader>

                <DrawerBody className="space-y-6">
                    {/* User Info */}
                    <div className="flex items-center gap-4">
                        <Avatar className="h-16 w-16">
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
                            <div className="space-y-2">
                                <Label htmlFor="displayName">姓名</Label>
                                <Input
                                    id="displayName"
                                    value={displayName}
                                    onChange={(e) => setDisplayName(e.target.value)}
                                    placeholder="请输入姓名"
                                />
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

                            <div className="space-y-2">
                                <Label htmlFor="address">住址</Label>
                                <Input
                                    id="address"
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="请输入居住地址"
                                />
                            </div>

                            {/* Link to full profile */}
                            <div className="rounded-lg border border-border bg-muted/50 p-3">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm font-medium">完整资料</p>
                                        <p className="text-xs text-muted-foreground">
                                            编辑更多信息，如简介、密码、设备等
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
                </DrawerBody>

                <DrawerFooter className="gap-2 border-t border-border/60 pt-4">
                    <DrawerClose asChild>
                        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                            取消
                        </Button>
                    </DrawerClose>
                    <Button onClick={handleSave} disabled={loading || saving}>
                        {saving ? "保存中..." : "保存"}
                    </Button>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>
    );
}
