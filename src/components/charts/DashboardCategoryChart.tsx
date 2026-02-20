"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import type { CategoryStat } from "@/types/finance";
import { useTheme } from "@/context/ThemeContext";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface DashboardCategoryChartProps {
  /** 本月分类统计，按金额降序（来自 getStats().categoryStats） */
  categoryStats: CategoryStat[];
  /** 显示 top N 分类，其余合并为「其他」，默认 5 */
  topN?: number;
}

/** 本月支出分类环形图（供 Dashboard 使用） */
export default function DashboardCategoryChart({
  categoryStats,
  topN = 5,
}: DashboardCategoryChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  // 只取支出分类（根据 percentage 及 amount 均为正数来判断；category 可能混杂收入）
  // 这里直接使用传入的数据，由调用方按需过滤
  const sorted = [...categoryStats].sort((a, b) => b.amount - a.amount);
  const top = sorted.slice(0, topN);
  const rest = sorted.slice(topN);
  const restAmount = rest.reduce((sum, c) => sum + c.amount, 0);

  const labels = [...top.map((c) => c.category), ...(restAmount > 0 ? ["其他"] : [])];
  const values = [...top.map((c) => c.amount), ...(restAmount > 0 ? [restAmount] : [])];

  const palette = [
    "#3b82f6", "#22c55e", "#f59e0b", "#8b5cf6",
    "#ef4444", "#06b6d4", "#a3a3a3",
  ];

  const options: ApexOptions = {
    chart: {
      type: "donut",
      fontFamily: "Inter, sans-serif",
      background: "transparent",
      toolbar: { show: false },
    },
    theme: {
      mode: isDark ? "dark" : "light",
    },
    colors: palette,
    labels,
    legend: {
      show: true,
      position: "bottom",
      fontSize: "12px",
      itemMargin: {
        horizontal: 5,
        vertical: 2,
      },
      formatter: (seriesName: string, opts: { w: { globals: { series: number[] } }; seriesIndex: number }) => {
        const amount = opts.w.globals.series[opts.seriesIndex] ?? 0;
        const formatted = `¥${amount.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
        return `${seriesName} (${formatted})`;
      },
    },
    dataLabels: {
      enabled: false,
    },
    plotOptions: {
      pie: {
        donut: {
          size: "65%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "本月支出",
              fontSize: "12px",
              color: "#6b7280",
              formatter: (w: { globals: { seriesTotals: number[] } }) => {
                const total = w.globals.seriesTotals.reduce((a: number, b: number) => a + b, 0);
                return `¥${total.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`;
              },
            },
          },
        },
      },
    },
    tooltip: {
      y: {
        formatter: (value: number) =>
          `¥ ${value.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`,
      },
    },
    stroke: {
      width: 2,
      colors: [isDark ? "#1e293b" : "#ffffff"], // Match card background (#1e293b is typical Slate-800 for cool dark mode, let's use transparent if it fails, or typical bg-card)
    },
  };

  if (!values.length) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-muted-foreground">
        暂无分类数据
      </div>
    );
  }

  return (
    <div className="w-full">
      <ReactApexChart options={options} series={values} type="donut" height={260} />
    </div>
  );
}
