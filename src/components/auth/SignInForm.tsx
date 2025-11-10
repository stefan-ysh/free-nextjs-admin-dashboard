"use client";
import Checkbox from "@/components/form/input/Checkbox";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import Button from "@/components/ui/button/Button";
import { ChevronLeftIcon, EyeCloseIcon, EyeIcon } from "@/icons";
import { useAuth } from "@/app/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";
import React, { useState } from "react";

export default function SignInForm() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { refresh } = useAuth();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (loading) return;

    if (!email || !password) {
      setError("请输入邮箱和密码");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password, rememberMe }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.error ?? "登录失败，请检查账号密码");
        return;
      }

  await refresh();
  router.replace("/");
  router.refresh();
    } catch (err) {
      console.error("登录请求失败", err);
      setError("服务器异常，请稍后重试");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex flex-col flex-1 w-full lg:w-1/2">
      <div className="w-full max-w-md mx-auto mb-5 sm:pt-10">
        <Link
          href="/"
          prefetch={false}
          className="inline-flex items-center text-sm text-gray-500 transition-colors hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
        >
          <ChevronLeftIcon />
          返回仪表盘
        </Link>

        <div className="mt-8 sm:mt-10">
          <div className="mb-5 sm:mb-8">
            <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
              登录
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              使用邮箱和密码登录
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="space-y-6">
              <div>
                <Label>
                   邮箱 <span className="text-error-500">*</span>
                </Label>
                <Input
                  placeholder="info@gmail.com"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
              </div>

              <div>
                <Label>
                  密码 <span className="text-error-500">*</span>
                </Label>
                <div className="relative">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                  >
                    {showPassword ? (
                      <EyeIcon className="fill-gray-500 dark:fill-gray-400" />
                    ) : (
                      <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400" />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center gap-3">
                  <Checkbox checked={rememberMe} onChange={setRememberMe} />
                  <span className="font-normal text-gray-700 text-theme-sm dark:text-gray-400">
                    保持登录
                  </span>
                </label>
                <Link
                  href="/reset-password"
                  prefetch={false}
                  className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400"
                >
                  忘记密码?
                </Link>
              </div>

              {error && (
                <div className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 dark:bg-red-900/30 dark:text-red-300">
                  {error}
                </div>
              )}

              <div>
                <Button className="w-full" size="sm" disabled={loading}>
                  {loading ? "Signing in..." : "Sign in"}
                </Button>
              </div>
            </div>
          </form>

          {/* <div className="mt-5">
            <p className="text-sm font-normal text-center text-gray-700 dark:text-gray-400 sm:text-left">
              Don&apos;t have an account?{" "}
              <Link
                href="/signup"
                className="text-brand-500 hover:text-brand-600 dark:text-brand-400"
              >
                Sign Up
              </Link>
            </p>
          </div> */}
        </div>
      </div>
    </div>
  );
}
