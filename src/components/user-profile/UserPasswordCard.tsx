"use client";

import React, { useMemo, useState } from "react";

import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";

type PasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

type UserPasswordCardProps = {
  passwordUpdatedAt: string | null;
  onChangePassword: (payload: PasswordPayload) => Promise<void>;
  loading?: boolean;
};

function formatPasswordUpdatedAt(timestamp: string | null) {
  if (!timestamp) return "尚未更新过密码";
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "上次更新时间未知";
  }
  return date.toLocaleString();
}

export default function UserPasswordCard({ passwordUpdatedAt, onChangePassword, loading = false }: UserPasswordCardProps) {
  const [formState, setFormState] = useState<PasswordPayload>({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const formattedUpdatedAt = useMemo(() => formatPasswordUpdatedAt(passwordUpdatedAt), [passwordUpdatedAt]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      await onChangePassword({
        currentPassword: formState.currentPassword,
        newPassword: formState.newPassword,
        confirmPassword: formState.confirmPassword,
      });
      setFormState({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setSuccess("密码已更新");
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "更新密码失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const handleInputChange = (key: keyof PasswordPayload) => (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormState((prev) => ({ ...prev, [key]: event.target.value }));
  };

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-3">账户密码</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400">建议定期更新密码，提升账户安全性。</p>
          <p className="mt-2 text-xs text-gray-400 dark:text-gray-500">上次更新时间：{formattedUpdatedAt}</p>
        </div>
      </div>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
          <div>
            <Label>当前密码</Label>
            <Input
              type="password"
              value={formState.currentPassword}
              onChange={handleInputChange("currentPassword")}
              disabled={saving || loading}
            />
          </div>
          <div>
            <Label>新密码</Label>
            <Input
              type="password"
              value={formState.newPassword}
              onChange={handleInputChange("newPassword")}
              disabled={saving || loading}
            />
          </div>
          <div>
            <Label>确认新密码</Label>
            <Input
              type="password"
              value={formState.confirmPassword}
              onChange={handleInputChange("confirmPassword")}
              disabled={saving || loading}
            />
          </div>
        </div>
        {error && <p className="text-sm text-error-500">{error}</p>}
        {success && <p className="text-sm text-green-500">{success}</p>}
        <div className="flex items-center justify-end gap-3">
          <Button size="sm" variant="outline" type="reset" disabled={saving || loading} onClick={() => setFormState({ currentPassword: "", newPassword: "", confirmPassword: "" })}>
            重置
          </Button>
          <Button size="sm" type="submit" disabled={saving || loading}>
            {saving ? "保存中..." : "更新密码"}
          </Button>
        </div>
      </form>
    </div>
  );
}
