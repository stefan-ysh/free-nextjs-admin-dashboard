import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "宇元新材管理后台 - 登录",
  description: "管理后台登录页面，提供用户身份验证功能。",
};

export default function SignIn() {
  return <SignInForm />;
}
