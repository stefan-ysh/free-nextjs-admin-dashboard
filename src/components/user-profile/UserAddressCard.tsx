"use client";

import React, { useEffect, useState } from "react";

import { useModal } from "../../hooks/useModal";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogBody, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ProfileData } from "./types";

type UserAddressCardProps = {
  profile: ProfileData | null;
  onUpdate: (payload: {
    country: string | null;
    city: string | null;
    postalCode: string | null;
    taxId: string | null;
  }) => Promise<void>;
  loading?: boolean;
};

export default function UserAddressCard({ profile, onUpdate, loading = false }: UserAddressCardProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formState, setFormState] = useState({
    country: "",
    city: "",
    postalCode: "",
    taxId: "",
  });

  useEffect(() => {
    if (!profile) return;
    setFormState({
      country: profile.country ?? "",
      city: profile.city ?? "",
      postalCode: profile.postalCode ?? "",
      taxId: profile.taxId ?? "",
    });
  }, [profile, isOpen]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      await onUpdate({
        country: formState.country,
        city: formState.city,
        postalCode: formState.postalCode,
        taxId: formState.taxId,
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
    <>
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">地址信息</h4>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 2xl:gap-x-32">
              <div>
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">国家/地区</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {loading ? "加载中..." : profile?.country || "未填写"}
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">城市</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {loading ? "加载中..." : profile?.city || "未填写"}
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">邮编</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {loading ? "加载中..." : profile?.postalCode || "未填写"}
                </p>
              </div>

              <div>
                <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">税号</p>
                <p className="text-sm font-medium text-gray-800 dark:text-white/90">
                  {loading ? "加载中..." : profile?.taxId || "未填写"}
                </p>
              </div>
            </div>
          </div>

          <Button size="sm" variant="outline" onClick={openModal} className="w-full lg:w-auto" disabled={loading || !profile} type="button">
            编辑
          </Button>
        </div>
      </div>
      <Dialog open={isOpen} onOpenChange={(nextOpen) => (nextOpen ? openModal() : closeModal())}>
        <DialogContent className="max-w-[640px]">
          <DialogHeader>
            <DialogTitle>编辑地址信息</DialogTitle>
            <DialogDescription>完善联系地址有助于发票、对账等工作。</DialogDescription>
          </DialogHeader>
          <DialogBody>
            <form id="user-address-form" className="flex flex-col gap-6" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                <div>
                  <Label>国家/地区</Label>
                  <Input
                    type="text"
                    value={formState.country}
                    onChange={(event) => setFormState((prev) => ({ ...prev, country: event.target.value }))}
                  />
                </div>

                <div>
                  <Label>城市</Label>
                  <Input
                    type="text"
                    value={formState.city}
                    onChange={(event) => setFormState((prev) => ({ ...prev, city: event.target.value }))}
                  />
                </div>

                <div>
                  <Label>邮编</Label>
                  <Input
                    type="text"
                    value={formState.postalCode}
                    onChange={(event) => setFormState((prev) => ({ ...prev, postalCode: event.target.value }))}
                  />
                </div>

                <div>
                  <Label>税号</Label>
                  <Input
                    type="text"
                    value={formState.taxId}
                    onChange={(event) => setFormState((prev) => ({ ...prev, taxId: event.target.value }))}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-error-500">{error}</p>}
            </form>
          </DialogBody>
          <DialogFooter>
            <Button size="sm" variant="outline" type="button" onClick={closeModal} disabled={saving}>
              取消
            </Button>
            <Button size="sm" type="submit" form="user-address-form" disabled={saving}>
              {saving ? "保存中..." : "保存修改"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
