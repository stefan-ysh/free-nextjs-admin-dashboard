"use client";

import React, { useCallback, useEffect, useState } from "react";

import { useAuth } from "@/app/auth-context";

import UserAddressCard from "./UserAddressCard";
import UserDevicesCard from "./UserDevicesCard";
import UserInfoCard from "./UserInfoCard";
import UserMetaCard from "./UserMetaCard";
import UserPasswordCard from "./UserPasswordCard";
import type { DeviceInfo, ProfileData } from "./types";

type ProfileUpdatePayload = {
  firstName: string | null;
  lastName: string | null;
  displayName: string | null;
  jobTitle: string | null;
  phone: string | null;
  bio: string | null;
  country: string | null;
  city: string | null;
  postalCode: string | null;
  taxId: string | null;
  socialLinks: Record<string, string | null>;
};

type ProfileUpdateOverrides = Partial<ProfileUpdatePayload>;

type PasswordPayload = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

const PROFILE_ENDPOINT = "/api/profile";
const AVATAR_ENDPOINT = "/api/profile/avatar";
const PASSWORD_ENDPOINT = "/api/profile/password";
const DEVICES_ENDPOINT = "/api/profile/devices";

function mergeProfilePayload(current: ProfileData, overrides: ProfileUpdateOverrides): ProfileUpdatePayload {
  const base: ProfileUpdatePayload = {
    firstName: current.firstName ?? null,
    lastName: current.lastName ?? null,
    displayName: current.displayName ?? null,
    jobTitle: current.jobTitle ?? null,
    phone: current.phone ?? null,
    bio: current.bio ?? null,
    country: current.country ?? null,
    city: current.city ?? null,
    postalCode: current.postalCode ?? null,
    taxId: current.taxId ?? null,
    socialLinks: { ...current.socialLinks },
  };

  const keys: Array<keyof Omit<ProfileUpdatePayload, "socialLinks">> = [
    "firstName",
    "lastName",
    "displayName",
    "jobTitle",
    "phone",
    "bio",
    "country",
    "city",
    "postalCode",
    "taxId",
  ];

  for (const key of keys) {
    if (Object.prototype.hasOwnProperty.call(overrides, key)) {
      const value = overrides[key];
      if (value !== undefined) {
        base[key] = value as ProfileUpdatePayload[typeof key];
      }
    }
  }

  if (Object.prototype.hasOwnProperty.call(overrides, "socialLinks")) {
    const nextLinks = { ...base.socialLinks };
    const overrideLinks = overrides.socialLinks ?? {};
    for (const [linkKey, linkValue] of Object.entries(overrideLinks)) {
      if (linkValue == null || linkValue === "") {
        delete nextLinks[linkKey];
      } else {
        nextLinks[linkKey] = linkValue;
      }
    }
    base.socialLinks = nextLinks;
  }

  return base;
}

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

export default function ProfileClient() {
  const { refresh } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [avatarUpdating, setAvatarUpdating] = useState(false);

  const [devices, setDevices] = useState<DeviceInfo[]>([]);
  const [devicesLoading, setDevicesLoading] = useState(true);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  const [refreshingDevices, setRefreshingDevices] = useState(false);
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const res = await fetch(PROFILE_ENDPOINT, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiResponse<ProfileData> | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error ?? "加载资料失败");
      }
      setProfile(json.data);
    } catch (err) {
      console.error(err);
      setProfile(null);
      setProfileError(err instanceof Error ? err.message : "加载资料失败，请稍后重试");
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const fetchDevices = useCallback(async (withSpinner: boolean) => {
    if (withSpinner) {
      setDevicesLoading(true);
    } else {
      setRefreshingDevices(true);
    }
    setDevicesError(null);
    try {
      const res = await fetch(DEVICES_ENDPOINT, { cache: "no-store" });
      const json = (await res.json().catch(() => null)) as ApiResponse<DeviceInfo[]> | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error ?? "加载设备列表失败");
      }
      setDevices(json.data);
    } catch (err) {
      console.error(err);
      setDevicesError(err instanceof Error ? err.message : "加载设备列表失败，请稍后重试");
      if (withSpinner) {
        setDevices([]);
      }
    } finally {
      if (withSpinner) {
        setDevicesLoading(false);
      } else {
        setRefreshingDevices(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchProfile();
    fetchDevices(true);
  }, [fetchProfile, fetchDevices]);

  const handleProfileUpdate = useCallback(
    async (overrides: ProfileUpdateOverrides) => {
      if (!profile) {
        throw new Error("资料尚未加载");
      }

      const payload = mergeProfilePayload(profile, overrides);

      const res = await fetch(PROFILE_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const json = (await res.json().catch(() => null)) as ApiResponse<ProfileData> | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error ?? "更新失败，请稍后重试");
      }

      setProfile(json.data);
      try {
        await refresh();
      } catch (err) {
        console.error('刷新用户上下文失败', err);
      }
    },
    [profile, refresh]
  );

  const handleAvatarUpdate = useCallback(
    async (dataUrl: string | null) => {
      if (!profile) {
        throw new Error("资料尚未加载");
      }
      setAvatarUpdating(true);
      try {
        const payload = dataUrl ? { avatar: dataUrl } : { clear: true };
        const res = await fetch(AVATAR_ENDPOINT, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const json = (await res.json().catch(() => null)) as ApiResponse<ProfileData> | null;
        if (!res.ok || !json?.success || !json.data) {
          throw new Error(json?.error ?? "头像更新失败");
        }
        setProfile(json.data);
        try {
          await refresh();
        } catch (err) {
          console.error('刷新用户上下文失败', err);
        }
      } finally {
        setAvatarUpdating(false);
      }
    },
    [profile, refresh]
  );

  const handlePasswordChange = useCallback(
    async (payload: PasswordPayload) => {
      const res = await fetch(PASSWORD_ENDPOINT, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? "更新密码失败，请稍后重试");
      }
      setProfile((prev) => {
        if (!prev) return prev;
        return { ...prev, passwordUpdatedAt: new Date().toISOString() };
      });
    },
    []
  );

  const handleRefreshDevices = useCallback(async () => {
    await fetchDevices(false);
  }, [fetchDevices]);

  const handleRevokeDevice = useCallback(
    async (sessionId: string) => {
      setRevokingId(sessionId);
      setDevicesError(null);
      try {
        const res = await fetch(DEVICES_ENDPOINT, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId }),
        });
        const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
        if (!res.ok || !json?.success) {
          throw new Error(json?.error ?? "移除设备失败");
        }
        setDevices((prev) => prev.filter((device) => device.id !== sessionId));
      } catch (err) {
        console.error(err);
        setDevicesError(err instanceof Error ? err.message : "移除设备失败");
        throw err instanceof Error ? err : new Error("移除设备失败");
      } finally {
        setRevokingId(null);
      }
    },
    []
  );

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:p-6">
      <h3 className="mb-5 text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-7">Profile</h3>
      {profileError && (
        <p className="mb-4 text-sm text-error-500">{profileError}</p>
      )}
      <div className="space-y-6">
        <UserMetaCard profile={profile} onProfileUpdate={handleProfileUpdate} onAvatarUpdate={handleAvatarUpdate} loading={profileLoading} avatarUpdating={avatarUpdating} />
        <UserInfoCard profile={profile} onUpdate={(payload) => handleProfileUpdate(payload)} loading={profileLoading} />
        <UserAddressCard profile={profile} onUpdate={(payload) => handleProfileUpdate(payload)} loading={profileLoading} />
        <UserPasswordCard passwordUpdatedAt={profile?.passwordUpdatedAt ?? null} onChangePassword={handlePasswordChange} loading={profileLoading} />
        <UserDevicesCard
          devices={devices}
          loading={devicesLoading}
          error={devicesError}
          refreshing={refreshingDevices}
          revokingId={revokingId}
          onRefresh={handleRefreshDevices}
          onRevoke={handleRevokeDevice}
        />
      </div>
    </div>
  );
}
