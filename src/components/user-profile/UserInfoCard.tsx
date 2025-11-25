"use client";

import React, { useEffect, useMemo, useState } from "react";

import { useModal } from "../../hooks/useModal";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
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
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    bio: string | null;
  }) => Promise<void>;
  loading?: boolean;
};

export default function UserInfoCard({ profile, onUpdate, loading = false }: UserInfoCardProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    bio: "",
  });

  useEffect(() => {
    if (!profile) return;
    setFormState({
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      phone: profile.phone ?? "",
      bio: profile.bio ?? "",
    });
  }, [profile, isOpen]);

  const fullName = useMemo(() => {
    if (!profile) return "";
    const parts = [profile.firstName, profile.lastName].filter(Boolean);
    return parts.join(" ");
  }, [profile]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      await onUpdate({
        firstName: formState.firstName,
        lastName: formState.lastName,
        phone: formState.phone,
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
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">基础信息</h4>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">姓名</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {loading ? "加载中..." : fullName || "未填写"}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">邮箱</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90 break-all">
                {profile?.email || (loading ? "加载中..." : "未填写")}
              </p>
            </div>

            <div>
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">手机号</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {loading ? "加载中..." : profile?.phone || "未填写"}
              </p>
            </div>

            <div className="lg:col-span-2">
              <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">个人简介</p>
              <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                {loading ? "加载中..." : profile?.bio || "未填写"}
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
          <form className="flex flex-col gap-6" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
              <div className="space-y-2">
                <Label>名</Label>
                <Input
                  type="text"
                  value={formState.firstName}
                  onChange={(event) => setFormState((prev) => ({ ...prev, firstName: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>姓</Label>
                <Input
                  type="text"
                  value={formState.lastName}
                  onChange={(event) => setFormState((prev) => ({ ...prev, lastName: event.target.value }))}
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
              <div className="space-y-2 lg:col-span-2">
                <Label>个人简介</Label>
                <Textarea
                  rows={4}
                  value={formState.bio}
                  onChange={(event) => setFormState((prev) => ({ ...prev, bio: event.target.value }))}
                />
              </div>
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button size="sm" variant="outline" type="button" onClick={closeModal} disabled={saving}>
                取消
              </Button>
              <Button size="sm" type="submit" disabled={saving}>
                {saving ? "保存中..." : "保存修改"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
