"use client";

import React, { useEffect, useMemo, useState } from "react";

import { useModal } from "../../hooks/useModal";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProfileData } from "./types";

type UserInfoCardProps = {
  profile: ProfileData | null;
  onUpdate: (payload: {
    displayName: string | null;
    phone: string | null;
    address: string | null;
    bio: string | null;
  }) => Promise<void>;
  loading?: boolean;
};

export default function UserInfoCard({ profile, onUpdate, loading = false }: UserInfoCardProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    displayName: "",
    phone: "",
    address: "",
    bio: "",
  });

  useEffect(() => {
    if (!profile) return;
    setFormState({
      displayName: profile.displayName ?? "",
      phone: profile.phone ?? "",
      address: profile.address ?? "",
      bio: profile.bio ?? "",
    });
  }, [profile, isOpen]);

  const fullName = useMemo(() => {
    if (!profile) return "";
    return profile.displayName ?? "";
  }, [profile]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      await onUpdate({
        displayName: formState.displayName,
        phone: formState.phone,
        address: formState.address,
        bio: formState.bio,
      });
      closeModal();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-5 border border-border rounded-2xl lg:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="items-center w-full gap-6 lg:flex-row lg:items-center lg:gap-8">
          <h4 className="text-lg font-semibold text-foreground lg:mb-6">基础信息</h4>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-6 2xl:gap-x-32">
            <div>
              <p className="mb-2 text-xs leading-normal text-muted-foreground">姓名</p>
              <p className="text-sm font-medium text-foreground">
                {loading ? "加载中..." : fullName || "未填写"}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-muted-foreground">邮箱</p>
              <p className="text-sm font-medium text-foreground break-all">
                {profile?.email || (loading ? "加载中..." : "未填写")}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-muted-foreground">手机号</p>
              <p className="text-sm font-medium text-foreground">
                {loading ? "加载中..." : profile?.phone || "未填写"}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-muted-foreground">住址</p>
              <p className="text-sm font-medium text-foreground">
                {loading ? "加载中..." : profile?.address || "未填写"}
              </p>
            </div>
           
          </div>
        </div>

        <Button
          size="sm"
          variant="outline"
          onClick={openModal}
          className="w-full lg:w-auto"
          disabled={loading || !profile}
          type="button"
        >
          编辑
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-[640px]">
          <DialogHeader>
            <DialogTitle>编辑基础信息</DialogTitle>
            <DialogDescription>更新您的个人资料以便团队成员了解您。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form id="user-info-form" className="flex flex-col gap-6" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div className="space-y-2">
                  <Label>姓名</Label>
                  <Input
                    type="text"
                    value={formState.displayName}
                    onChange={(event) => setFormState((prev) => ({ ...prev, displayName: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>邮箱</Label>
                  <Input type="email" value={profile?.email ?? ""} disabled />
                </div>
                <div className="space-y-2">
                  <Label>手机号</Label>
                  <Input
                    type="tel"
                    value={formState.phone}
                    onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>住址</Label>
                  <Input
                    type="text"
                    value={formState.address}
                    onChange={(event) => setFormState((prev) => ({ ...prev, address: event.target.value }))}
                    placeholder="请输入居住地址"
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button size="sm" variant="outline" type="button" onClick={closeModal} disabled={saving}>
              取消
            </Button>
            <Button size="sm" type="submit" form="user-info-form" disabled={saving}>
              {saving ? "保存中..." : "保存修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
