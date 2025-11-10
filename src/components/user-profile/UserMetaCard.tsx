"use client";

import Image from "next/image";
import React, { useEffect, useMemo, useRef, useState } from "react";

import { useModal } from "../../hooks/useModal";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Button from "../ui/button/Button";
import { Modal } from "../ui/modal";
import type { ProfileData } from "./types";

type SocialKey = "facebook" | "x" | "linkedin" | "instagram" | "website";

const SOCIAL_CONFIG: Array<{
  key: SocialKey;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
}> = [
  {
    key: "facebook",
    label: "Facebook",
    placeholder: "https://facebook.com/username",
    icon: (
      <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M11.6666 11.2503H13.7499L14.5833 7.91699H11.6666V6.25033C11.6666 5.39251 11.6666 4.58366 13.3333 4.58366H14.5833V1.78374C14.3118 1.7477 13.2858 1.66699 12.2023 1.66699C9.94025 1.66699 8.33325 3.04771 8.33325 5.58342V7.91699H5.83325V11.2503H8.33325V18.3337H11.6666V11.2503Z" fill="" />
      </svg>
    ),
  },
  {
    key: "x",
    label: "X",
    placeholder: "https://x.com/username",
    icon: (
      <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M15.1708 1.875H17.9274L11.9049 8.75833L18.9899 18.125H13.4424L9.09742 12.4442L4.12578 18.125H1.36745L7.80912 10.7625L1.01245 1.875H6.70078L10.6283 7.0675L15.1708 1.875ZM14.2033 16.475H15.7308L5.87078 3.43833H4.23162L14.2033 16.475Z" fill="" />
      </svg>
    ),
  },
  {
    key: "linkedin",
    label: "LinkedIn",
    placeholder: "https://www.linkedin.com/in/username",
    icon: (
      <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M5.78381 4.16645C5.78351 4.84504 5.37181 5.45569 4.74286 5.71045C4.11391 5.96521 3.39331 5.81321 2.92083 5.32613C2.44836 4.83904 2.31837 4.11413 2.59216 3.49323C2.86596 2.87233 3.48886 2.47942 4.16715 2.49978C5.06804 2.52682 5.78422 3.26515 5.78381 4.16645ZM5.83381 7.06645H2.50048V17.4998H5.83381V7.06645ZM11.1005 7.06645H7.78381V17.4998H11.0672V12.0248C11.0672 8.97475 15.0422 8.69142 15.0422 12.0248V17.4998H18.3338V10.8914C18.3338 5.74978 12.4505 5.94145 11.0672 8.46642L11.1005 7.06645Z" fill="" />
      </svg>
    ),
  },
  {
    key: "instagram",
    label: "Instagram",
    placeholder: "https://www.instagram.com/username",
    icon: (
      <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10.8567 1.66699C11.7946 1.66854 12.2698 1.67351 12.6805 1.68573L12.8422 1.69102C13.0291 1.69766 13.2134 1.70599 13.4357 1.71641C14.3224 1.75738 14.9273 1.89766 15.4586 2.10391C16.0078 2.31572 16.4717 2.60183 16.9349 3.06503C17.3974 3.52822 17.6836 3.99349 17.8961 4.54141C18.1016 5.07197 18.2419 5.67753 18.2836 6.56433C18.2935 6.78655 18.3015 6.97088 18.3081 7.15775L18.3133 7.31949C18.3255 7.73011 18.3311 8.20543 18.3328 9.1433L18.3335 9.76463C18.3336 9.84055 18.3336 9.91888 18.3336 9.99972L18.3335 10.2348L18.333 10.8562C18.3314 11.794 18.3265 12.2694 18.3142 12.68L18.3089 12.8417C18.3023 13.0286 18.294 13.213 18.2836 13.4351C18.2426 14.322 18.1016 14.9268 17.8961 15.458C17.6842 16.0074 17.3974 16.4713 16.9349 16.9345C16.4717 17.397 16.0057 17.6831 15.4586 17.8955C14.9273 18.1011 14.3224 18.2414 13.4357 18.2831C13.2134 18.293 13.0291 18.3011 12.8422 18.3076L12.6805 18.3128C12.2698 18.3251 11.7946 18.3306 10.8567 18.3324L10.2353 18.333C10.1594 18.333 10.0811 18.333 10.0002 18.333H9.76516L9.14375 18.3325C8.20591 18.331 7.7306 18.326 7.31997 18.3137L7.15824 18.3085C6.97136 18.3018 6.78703 18.2935 6.56481 18.2831C5.67801 18.2421 5.07384 18.1011 4.5419 17.8955C3.99328 17.6838 3.5287 17.397 3.06551 16.9345C2.60231 16.4713 2.3169 16.0053 2.1044 15.458C1.89815 14.9268 1.75856 14.322 1.7169 13.4351C1.707 13.213 1.69892 13.0286 1.69238 12.8417L1.68714 12.68C1.67495 12.2694 1.66939 11.794 1.66759 10.8562L1.66748 9.1433C1.66903 8.20543 1.67399 7.73011 1.68621 7.31949L1.69151 7.15775C1.69815 6.97088 1.70648 6.78655 1.7169 6.56433C1.75786 5.67683 1.89815 5.07266 2.1044 4.54141C2.3162 3.9928 2.60231 3.52822 3.06551 3.06503C3.5287 2.60183 3.99398 2.31641 4.5419 2.10391C5.07315 1.89766 5.67731 1.75808 6.56481 1.71641C6.78703 1.70652 6.97136 1.69844 7.15824 1.6919L7.31997 1.68666C7.7306 1.67446 8.20591 1.6689 9.14375 1.6671L10.8567 1.66699ZM10.0002 5.83308C7.69781 5.83308 5.83356 7.69935 5.83356 9.99972C5.83356 12.3021 7.69984 14.1664 10.0002 14.1664C12.3027 14.1664 14.1669 12.3001 14.1669 9.99972C14.1669 7.69732 12.3006 5.83308 10.0002 5.83308ZM10.0002 7.49974C11.381 7.49974 12.5002 8.61863 12.5002 9.99972C12.5002 11.3805 11.3813 12.4997 10.0002 12.4997C8.6195 12.4997 7.50023 11.3809 7.50023 9.99972C7.50023 8.61897 8.61908 7.49974 10.0002 7.49974ZM14.3752 4.58308C13.8008 4.58308 13.3336 5.04967 13.3336 5.62403C13.3336 6.19841 13.8002 6.66572 14.3752 6.66572C14.9496 6.66572 15.4169 6.19913 15.4169 5.62403C15.4169 5.04967 14.9488 4.58236 14.3752 4.58308Z" fill="" />
      </svg>
    ),
  },
  {
    key: "website",
    label: "Website",
    placeholder: "https://example.com",
    icon: (
      <svg className="fill-current" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 1.667C5.39754 1.667 1.66663 5.39792 1.66663 10.0003C1.66663 14.6027 5.39754 18.3336 10 18.3336C14.6024 18.3336 18.3333 14.6027 18.3333 10.0003C18.3333 5.39792 14.6024 1.667 10 1.667ZM10 3.167C10.3587 3.167 10.7087 3.19569 11.0478 3.25028C10.1975 4.35547 9.60216 5.78378 9.38166 7.33359H6.85616C7.15074 5.07145 8.30237 3.167 10 3.167ZM5.20616 7.33359H3.21491C3.73574 5.68378 4.82907 4.28795 6.25266 3.43528C5.63749 4.50195 5.27957 5.84862 5.20616 7.33359ZM3.21491 12.667H5.20616C5.27957 14.152 5.63749 15.4986 6.25266 16.5653C4.82907 15.7126 3.73574 14.3168 3.21491 12.667ZM6.85616 12.667H9.38166C9.60216 14.2168 10.1975 15.6451 11.0478 16.7503C10.7087 16.8049 10.3587 16.8336 10 16.8336C8.30237 16.8336 7.15074 14.9291 6.85616 12.667ZM12.8183 16.2053C12.1188 15.2626 11.6108 14.0399 11.4233 12.667H14.6166C14.342 13.9668 13.6741 15.0964 12.8183 16.2053ZM14.6166 7.33359H11.4233C11.6108 5.96028 12.1188 4.73762 12.8183 3.79492C13.6741 4.90378 14.342 6.03328 14.6166 7.33359ZM15.0103 3.79492C16.4339 4.64759 17.5272 6.04345 18.0481 7.69328H16.0568C15.9834 6.20831 15.6255 4.86164 15.0103 3.79492ZM18.0481 12.667H16.0568C15.9834 14.152 15.6255 15.4986 15.0103 16.5653C16.4339 15.7126 17.5272 14.3168 18.0481 12.667Z" fill="" />
      </svg>
    ),
  },
];

type UserMetaCardProps = {
  profile: ProfileData | null;
  onProfileUpdate: (payload: {
    displayName: string | null;
    jobTitle: string | null;
    socialLinks: Record<string, string | null>;
  }) => Promise<void>;
  onAvatarUpdate: (dataUrl: string | null) => Promise<void>;
  loading?: boolean;
  avatarUpdating?: boolean;
};

export default function UserMetaCard({ profile, onProfileUpdate, onAvatarUpdate, loading = false, avatarUpdating = false }: UserMetaCardProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [formState, setFormState] = useState({
    displayName: "",
    jobTitle: "",
    socialLinks: SOCIAL_CONFIG.reduce<Record<SocialKey, string>>((acc, item) => {
      acc[item.key] = "";
      return acc;
    }, {} as Record<SocialKey, string>),
  });

  useEffect(() => {
    if (!profile) return;
    setFormState({
      displayName: profile.displayName ?? "",
      jobTitle: profile.jobTitle ?? "",
      socialLinks: SOCIAL_CONFIG.reduce<Record<SocialKey, string>>((acc, item) => {
        const value = profile.socialLinks?.[item.key] ?? "";
        acc[item.key] = typeof value === "string" ? value : "";
        return acc;
      }, {} as Record<SocialKey, string>),
    });
  }, [profile, isOpen]);

  const displayName = useMemo(() => {
    if (!profile) return "";
    return profile.displayName || [profile.firstName, profile.lastName].filter(Boolean).join(" ") || profile.email;
  }, [profile]);

  const avatarInfo = useMemo(() => {
    const fallback = "/images/user/owner.jpg";
    if (!profile?.avatarUrl) {
      return { src: fallback, unoptimized: false };
    }
    const src = profile.avatarUrl;
    const isLocal = src.startsWith("/") || src.startsWith("./") || src.startsWith("../");
    const isDataUrl = src.startsWith("data:");
    return { src, unoptimized: isDataUrl || !isLocal };
  }, [profile]);

  const location = useMemo(() => {
    if (!profile) return "";
    const parts = [profile.city, profile.country].filter(Boolean);
    return parts.join(", ");
  }, [profile]);

  const handleOpenFilePicker = () => {
    if (loading) return;
    fileInputRef.current?.click();
  };

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (file.size > 1024 * 1024) {
      setAvatarError("请选择 1MB 以下的图片");
      return;
    }

    setAvatarError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await onAvatarUpdate(typeof reader.result === "string" ? reader.result : null);
      } catch (err) {
        console.error(err);
        setAvatarError(err instanceof Error ? err.message : "头像上传失败");
      }
    };
    reader.onerror = () => {
      setAvatarError("读取图片失败，请重试");
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarRemove = async () => {
    try {
      setAvatarError(null);
      await onAvatarUpdate(null);
    } catch (err) {
      console.error(err);
      setAvatarError(err instanceof Error ? err.message : "移除头像失败");
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setSaving(true);
    setError(null);
    try {
      await onProfileUpdate({
        displayName: formState.displayName,
        jobTitle: formState.jobTitle,
        socialLinks: Object.entries(formState.socialLinks).reduce<Record<string, string | null>>((acc, [key, value]) => {
          acc[key] = value.trim() ? value.trim() : null;
          return acc;
        }, {}),
      });
      closeModal();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "保存失败，请稍后重试");
    } finally {
      setSaving(false);
    }
  };

  const socialLinks = profile?.socialLinks ?? {};

  return (
    <>
      <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col items-center w-full gap-6 xl:flex-row">
            <div className="relative w-20 h-20 overflow-hidden border border-gray-200 rounded-full dark:border-gray-800">
              <Image width={80} height={80} src={avatarInfo.src} alt={displayName || "用户头像"} unoptimized={avatarInfo.unoptimized} className={loading ? "animate-pulse" : ""} />
              <button
                className="absolute inset-0 flex items-center justify-center text-xs font-medium text-white transition-opacity bg-gray-900/70 opacity-0 hover:opacity-100"
                onClick={handleOpenFilePicker}
                type="button"
                disabled={loading || avatarUpdating || !profile}
              >
                {avatarUpdating ? "上传中" : "更换头像"}
              </button>
            </div>
            <div className="order-3 text-center xl:order-2 xl:text-left">
              <h4 className="mb-1 text-lg font-semibold text-gray-800 dark:text-white/90">
                {loading ? "加载中..." : displayName || "未命名用户"}
              </h4>
              <div className="flex flex-col items-center gap-1 text-center text-sm text-gray-500 dark:text-gray-400 xl:flex-row xl:gap-3 xl:text-left">
                <span>{profile?.jobTitle || (loading ? "" : "未填写职位")}</span>
                <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                <span>{location || (loading ? "" : "未填写地区")}</span>
              </div>
            </div>
            <div className="flex items-center order-2 gap-2 grow xl:order-3 xl:justify-end">
              {SOCIAL_CONFIG.map(({ key, icon, label }) => {
                const url = socialLinks?.[key] ?? "";
                const isActive = Boolean(url);
                const commonClasses = "flex h-11 w-11 items-center justify-center rounded-full border text-sm font-medium shadow-theme-xs";
                const baseClasses = "border-gray-300 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200";
                if (isActive) {
                  return (
                    <a
                      key={key}
                      href={url as string}
                      target="_blank"
                      rel="noreferrer"
                      className={`${commonClasses} ${baseClasses}`}
                      title={label}
                    >
                      {icon}
                    </a>
                  );
                }
                return (
                  <div
                    key={key}
                    className={`${commonClasses} ${baseClasses} opacity-40 cursor-not-allowed`}
                    aria-disabled
                    title={`${label} 未设置`}
                  >
                    {icon}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-col gap-3 w-full sm:flex-row sm:w-auto sm:items-center">
            <Button
              size="sm"
              variant="outline"
              className="w-full sm:w-auto"
              onClick={handleAvatarRemove}
              disabled={avatarUpdating || loading || !profile?.avatarUrl || !profile}
              type="button"
            >
              移除头像
            </Button>
            <Button
              size="sm"
              className="w-full sm:w-auto"
              onClick={openModal}
              disabled={loading || !profile}
              type="button"
            >
              编辑
            </Button>
          </div>
        </div>
        {avatarError && (
          <p className="mt-3 text-sm text-error-500">{avatarError}</p>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png, image/jpeg, image/webp"
        className="hidden"
        onChange={handleAvatarChange}
      />
      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[640px] m-4">
        <div className="no-scrollbar relative w-full max-w-[640px] overflow-y-auto rounded-3xl bg-white p-4 dark:bg-gray-900 lg:p-9">
          <div className="px-2">
            <h4 className="mb-2 text-2xl font-semibold text-gray-800 dark:text-white/90">编辑个人信息</h4>
            <p className="mb-6 text-sm text-gray-500 dark:text-gray-400">填写社交链接与展示信息，方便团队识别。</p>
          </div>
          <form className="flex flex-col" onSubmit={handleSubmit}>
            <div className="custom-scrollbar max-h-[420px] overflow-y-auto px-2 pb-3">
              <div className="mb-7">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90">展示信息</h5>
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="col-span-2 lg:col-span-1">
                    <Label>显示名称</Label>
                    <Input
                      type="text"
                      value={formState.displayName}
                      onChange={(event) => setFormState((prev) => ({ ...prev, displayName: event.target.value }))}
                    />
                  </div>
                  <div className="col-span-2 lg:col-span-1">
                    <Label>职位</Label>
                    <Input
                      type="text"
                      value={formState.jobTitle}
                      onChange={(event) => setFormState((prev) => ({ ...prev, jobTitle: event.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90">社交链接</h5>
                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  {SOCIAL_CONFIG.map(({ key, label, placeholder }) => (
                    <div key={key}>
                      <Label>{label}</Label>
                      <Input
                        type="text"
                        value={formState.socialLinks[key] ?? ""}
                        placeholder={placeholder}
                        onChange={(event) =>
                          setFormState((prev) => ({
                            ...prev,
                            socialLinks: { ...prev.socialLinks, [key]: event.target.value },
                          }))
                        }
                      />
                    </div>
                  ))}
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
    </>
  );
}
