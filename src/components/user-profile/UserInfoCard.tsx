"use client";

import React, { useEffect, useMemo, useState } from "react";

import { useModal } from "../../hooks/useModal";
import TextArea from "../form/input/TextArea";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import { Modal } from "../ui/modal";
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

      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[640px] m-4">
        <div className="no-scrollbar relative w-full max-w-[640px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-9">
          <div className="px-2">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">编辑基础信息</h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">更新您的个人资料以便团队成员了解您。</p>
          </div>
          <form className="flex flex-col" onSubmit={handleSubmit}>
            <div className="custom-scrollbar max-h-[420px] overflow-y-auto px-2 pb-3">
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div>
                  <Label>名</Label>
                  <Input
                    type="text"
                    value={formState.firstName}
                    onChange={(event) => setFormState((prev) => ({ ...prev, firstName: event.target.value }))}
                  />
                </div>
                <div>
                  <Label>姓</Label>
                  <Input
                    type="text"
                    value={formState.lastName}
                    onChange={(event) => setFormState((prev) => ({ ...prev, lastName: event.target.value }))}
                  />
                </div>
                <div>
                  <Label>邮箱</Label>
                  <Input type="email" value={profile?.email ?? ""} disabled />
                </div>
                <div>
                  <Label>手机号</Label>
                  <Input
                    type="tel"
                    value={formState.phone}
                    onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                </div>
                <div className="lg:col-span-2">
                  <Label>个人简介</Label>
                  <TextArea
                    rows={4}
                    value={formState.bio}
                    onChange={(value) => setFormState((prev) => ({ ...prev, bio: value }))}
                  />
                </div>
              </div>
            </div>
            {error && <p className="px-2 text-sm text-error-500">{error}</p>}
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" type="button" onClick={closeModal} disabled={saving}>
                取消
              </Button>
              <Button size="sm" type="submit" disabled={saving}>
                {saving ? "保存中..." : "保存修改"}
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </div>
  );
}
