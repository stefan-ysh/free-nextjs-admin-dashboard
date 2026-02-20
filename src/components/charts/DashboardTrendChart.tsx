"use client";

import React from "react";
import dynamic from "next/dynamic";
import type { ApexOptions } from "apexcharts";
import type { MonthlyTrendPoint } from "@/lib/db/finance";
import { useTheme } from "@/context/ThemeContext";

const ReactApexChart = dynamic(() => import("react-apexcharts"), { ssr: false });

interface DashboardTrendChartProps {
  data: MonthlyTrendPoint[];
}

/** 近 N 个月收支趋势面积图（供 Dashboard 使用） */
export default function DashboardTrendChart({ data }: DashboardTrendChartProps) {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const labels = data.map((d) => d.month);
  const incomeSeries = data.map((d) => d.income);
  const expenseSeries = data.map((d) => d.expense);

  const options: ApexOptions = {
    chart: {
      type: "area",
      height: 260,
      fontFamily: "Inter, sans-serif",
      toolbar: { show: false },
      zoom: { enabled: false },
      background: "transparent",
    },
    theme: {
      mode: isDark ? "dark" : "light",
    },
    dataLabels: { enabled: false },
    stroke: {
      curve: "smooth",
      width: [2, 2],
    },
    fill: {
      type: "gradient",
      gradient: {
        opacityFrom: 0.4,
        opacityTo: 0.02,
      },
    },
    colors: ["#22c55e", "#ef4444"],
    legend: {
      show: true,
      position: "top",
      horizontalAlign: "right",
      fontSize: "12px",
      markers: { size: 6 },
    },
    xaxis: {
      type: "category",
      categories: labels,
      axisBorder: { show: false },
      axisTicks: { show: false },
      labels: {
        style: { fontSize: "11px", colors: "#9ca3af" },
        rotate: -45,
        rotateAlways: false,
        hideOverlappingLabels: true,
      },
      tooltip: { enabled: false },
    },
    yaxis: {
      labels: {
        style: { fontSize: "11px", colors: ["#9ca3af"] },
        formatter: (value: number) => {
          if (value >= 10000) return `${(value / 10000).toFixed(1)}w`;
          return String(Math.round(value));
        },
      },
    },
    grid: {
      borderColor: isDark ? "#374151" : "#e5e7eb",
      strokeDashArray: 4,
      xaxis: { lines: { show: false } },
      yaxis: { lines: { show: true } },
    },
    markers: {
      size: 0,
      hover: { size: 5 },
    },
    tooltip: {
      shared: true,
      intersect: false,
      y: {
        formatter: (value: number) =>
          `¥ ${value.toLocaleString("zh-CN", { maximumFractionDigits: 0 })}`,
      },
    },
  };

  const series = [
    { name: "收入", data: incomeSeries },
    { name: "支出", data: expenseSeries },
  ];

  return (
    <div className="w-full -ml-2 sm:-ml-0">
      <ReactApexChart options={options} series={series} type="area" height={260} />
    </div>
  );
}
