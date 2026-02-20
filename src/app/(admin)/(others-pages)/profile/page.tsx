import ProfileClient from "@/components/user-profile/ProfileClient";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "管理后台 - 个人资料",
  description:
    "管理后台个人资料页面，展示用户的个人信息和编辑功能。",
};

export default function Profile() {
  return (
    <ProfileClient />
  );
}
