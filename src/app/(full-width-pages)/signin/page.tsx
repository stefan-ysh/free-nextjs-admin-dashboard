import { Metadata } from "next";
import SignInForm from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "登录 - 宇元新材管理后台",
  description: "登录到宇元新材管理后台",
};

export default function SignInPage() {
  return (
    <div className="container relative h-screen flex-col items-center justify-center grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <div className="mr-2 h-8 w-8 rounded-lg bg-white/10 p-1">
             {/* Placeholder for logo */}
             <div className="h-full w-full rounded bg-white" />
          </div>
          宇元新材
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              &ldquo;高效管理，智造未来。&rdquo;
            </p>
            <footer className="text-sm">Admin Dashboard</footer>
          </blockquote>
        </div>
      </div>
      <div className="p-6 lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">
              登录账户
            </h1>
            <p className="text-sm text-muted-foreground">
              请输入您的账号和密码以继续
            </p>
          </div>
          <SignInForm />
        </div>
      </div>
    </div>
  );
}
