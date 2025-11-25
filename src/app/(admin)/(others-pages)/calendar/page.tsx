import Calendar from "@/components/calendar/Calendar";
import { Metadata } from "next";
import React from "react";

export const metadata: Metadata = {
  title: "宇元新材管理后台 - 日历",
  description:
    "管理后台日历页面，展示日历的使用和样式。",
  // other metadata
};
export default function page() {
  return (
    <div className="flex h-full flex-col rounded-none border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <Calendar />
    </div>
  );
}
