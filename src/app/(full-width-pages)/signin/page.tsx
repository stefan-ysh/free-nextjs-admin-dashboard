import { Metadata } from "next";
import SignInForm from "@/components/auth/SignInForm";

export const metadata: Metadata = {
  title: "登录 - 管理系统",
  description: "登录到管理系统",
};

export default function SignInPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background lg:grid lg:grid-cols-2">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white dark:border-r lg:flex">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex items-center text-lg font-medium">
          <div className="mr-2 h-8 w-8 rounded-lg bg-white/10 p-1">
             {/* Placeholder for logo */}
             <div className="h-full w-full rounded bg-white" />
          </div>
          业务管理系统
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
      <div className="flex flex-1 items-center justify-center p-6 sm:p-8 lg:p-8">
        <div className="mx-auto flex w-full max-w-[350px] flex-col justify-center space-y-6">
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
