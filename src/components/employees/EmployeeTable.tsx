"use client";

import React from "react";

import Button from "@/components/ui/button/Button";
import {
  Table,
  TableBody,
  TableCell,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import EmployeeStatusBadge from "./EmployeeStatusBadge";
import type { EmployeeRecord } from "./types";

interface EmployeeTableProps {
  items: EmployeeRecord[];
  loading: boolean;
  onEdit: (employee: EmployeeRecord) => void;
  onDelete: (employee: EmployeeRecord) => void;
  deletingId: string | null;
}

function resolveName(item: EmployeeRecord): string {
  if (item.displayName && item.displayName.trim()) return item.displayName;
  return `${item.lastName}${item.firstName}`.trim() || item.email || "-";
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return value;
}

export default function EmployeeTable({ items, loading, onEdit, onDelete, deletingId }: EmployeeTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="max-w-full overflow-x-auto">
        <div className="min-w-[960px]">
          <Table>
            <TableHeader className="border-b border-gray-100 dark:border-gray-800">
              <TableRow>
                <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  姓名
                </TableCell>
                <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  部门
                </TableCell>
                <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  职位
                </TableCell>
                <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  邮箱
                </TableCell>
                <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  手机
                </TableCell>
                <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  入职日期
                </TableCell>
                <TableCell isHeader className="px-5 py-3 text-start text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  状态
                </TableCell>
                <TableCell isHeader className="px-5 py-3 text-end text-theme-xs font-medium text-gray-500 dark:text-gray-400">
                  操作
                </TableCell>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <TableRow>
                  <TableCell className="px-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400" colSpan={8}>
                    正在加载员工数据...
                  </TableCell>
                </TableRow>
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell className="px-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400" colSpan={8}>
                    暂无员工记录
                  </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="px-5 py-4 text-start text-theme-sm text-gray-800 dark:text-white/90">
                      <div className="flex flex-col">
                        <span className="font-medium">{resolveName(item)}</span>
                        {item.employeeCode && (
                          <span className="text-theme-xs text-gray-500 dark:text-gray-400">{item.employeeCode}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="px-5 py-4 text-theme-sm text-gray-600 dark:text-gray-300">
                      {item.department || "-"}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-theme-sm text-gray-600 dark:text-gray-300">
                      {item.jobTitle || "-"}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-theme-sm text-gray-600 dark:text-gray-300">
                      {item.email || "-"}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-theme-sm text-gray-600 dark:text-gray-300">
                      {item.phone || "-"}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-theme-sm text-gray-600 dark:text-gray-300">
                      {formatDate(item.hireDate)}
                    </TableCell>
                    <TableCell className="px-5 py-4 text-theme-sm text-gray-600 dark:text-gray-300">
                      <EmployeeStatusBadge status={item.employmentStatus} />
                    </TableCell>
                    <TableCell className="px-5 py-4 text-end">
                      <div className="flex justify-end gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => onEdit(item)}
                        >
                          编辑
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-error-200 text-error-600 hover:bg-error-50 dark:border-error-500/40 dark:text-error-400"
                          onClick={() => onDelete(item)}
                          disabled={deletingId === item.id}
                        >
                          {deletingId === item.id ? "删除中" : "删除"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
