"use client";

import React, { useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import type { DeviceInfo } from "./types";
import { formatDateTimeLocal } from "@/lib/dates";

type UserDevicesCardProps = {
  devices: DeviceInfo[];
  loading?: boolean;
  error?: string | null;
  refreshing?: boolean;
  revokingId?: string | null;
  onRefresh: () => Promise<void>;
  onRevoke: (sessionId: string) => Promise<void>;
};

function formatDateTime(value: string) {
  if (!value) return "时间未知";
  return formatDateTimeLocal(value) ?? value;
}

function resolveDeviceLabel(device: DeviceInfo) {
  if (device.isCurrent) return "当前使用";
  return device.deviceType === "mobile" ? "移动设备" : "桌面设备";
}

export default function UserDevicesCard({
  devices,
  loading = false,
  error = null,
  refreshing = false,
  revokingId = null,
  onRefresh,
  onRevoke,
}: UserDevicesCardProps) {
  const [actionMessage, setActionMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    if (error) {
      setActionMessage({ kind: "error", text: error });
    }
  }, [error]);

  const sortedDevices = useMemo(() => {
    return [...devices].sort((a, b) => new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime());
  }, [devices]);

  const handleRefresh = async () => {
    setActionMessage(null);
    try {
      await onRefresh();
      setActionMessage(null);
    } catch (err) {
      console.error(err);
      setActionMessage({ kind: "error", text: err instanceof Error ? err.message : "设备列表刷新失败" });
    }
  };

  const handleRevoke = async (sessionId: string) => {
    setActionMessage(null);
    try {
      await onRevoke(sessionId);
      setActionMessage({ kind: "success", text: "已移除指定设备" });
    } catch (err) {
      console.error(err);
      setActionMessage({ kind: "error", text: err instanceof Error ? err.message : "移除设备失败" });
    }
  };

  const isEmpty = !loading && sortedDevices.length === 0;

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90">登录设备</h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">查看最近登录和活动的设备，必要时可远程注销。</p>
        </div>
        <Button size="sm" variant="outline" type="button" onClick={handleRefresh} disabled={loading || refreshing}>
          {refreshing ? "刷新中..." : "刷新"}
        </Button>
      </div>

      {actionMessage && (
        <p className={`mt-4 text-sm ${actionMessage.kind === "error" ? "text-error-500" : "text-green-500"}`}>
          {actionMessage.text}
        </p>
      )}

      {loading ? (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">设备信息加载中...</p>
      ) : isEmpty ? (
        <p className="mt-6 text-sm text-gray-500 dark:text-gray-400">暂无其他登录设备。</p>
      ) : (
        <div className="mt-6 space-y-4">
          {sortedDevices.map((device) => {
            const isRevoking = revokingId === device.id;
            return (
              <div key={device.id} className="flex flex-col gap-4 rounded-xl border border-gray-200 p-4 dark:border-gray-800 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2 text-sm font-medium text-gray-800 dark:text-white/90">
                    <span>{resolveDeviceLabel(device)}</span>
                    {device.isCurrent && <span className="rounded-full bg-brand-500/10 px-3 py-1 text-xs font-medium text-brand-600">当前设备</span>}
                    {device.rememberMe && <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-600">保持登录</span>}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 break-words">{device.userAgent}</p>
                  <div className="grid grid-cols-1 gap-2 text-xs text-gray-400 dark:text-gray-500 sm:grid-cols-3">
                    <div>
                      <span className="block text-gray-500 dark:text-gray-400">上次活跃</span>
                      <span>{formatDateTime(device.lastActive)}</span>
                    </div>
                    <div>
                      <span className="block text-gray-500 dark:text-gray-400">登录时间</span>
                      <span>{formatDateTime(device.createdAt)}</span>
                    </div>
                    <div>
                      <span className="block text-gray-500 dark:text-gray-400">过期时间</span>
                      <span>{formatDateTime(device.expiresAt)}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    size="sm"
                    variant="outline"
                    type="button"
                    onClick={() => handleRevoke(device.id)}
                    disabled={device.isCurrent || isRevoking}
                  >
                    {device.isCurrent ? "当前设备" : isRevoking ? "移除中..." : "移除"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
