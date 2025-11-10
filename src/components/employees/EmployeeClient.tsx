"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/app/auth-context";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";
import Pagination from "@/components/tables/Pagination";

import EmployeeForm, { EmployeeFormValues } from "./EmployeeForm";
import EmployeeTable from "./EmployeeTable";
import type { EmployeeListResponse, EmployeeRecord, EmploymentStatus } from "./types";

const PAGE_SIZE = 10;
const EMPLOYEES_ENDPOINT = "/api/employees";

type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};

type StatusFilter = EmploymentStatus | "all";

function buildQuery(params: {
  page: number;
  pageSize: number;
  search?: string;
  department?: string | null;
  status?: StatusFilter;
}) {
  const query = new URLSearchParams();
  query.set("page", params.page.toString());
  query.set("pageSize", params.pageSize.toString());
  if (params.search) query.set("search", params.search);
  if (params.department) query.set("department", params.department);
  if (params.status && params.status !== "all") query.set("status", params.status);
  return query.toString();
}

export default function EmployeeClient() {
  const { user, loading: authLoading } = useAuth();

  const [items, setItems] = useState<EmployeeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [availableDepartments, setAvailableDepartments] = useState<string[]>([]);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const [formOpen, setFormOpen] = useState(false);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [editing, setEditing] = useState<EmployeeRecord | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [departmentFilter, statusFilter]);

  const fetchEmployees = useCallback(
    async (nextPage: number, signal?: AbortSignal) => {
      setLoading(true);
      setError(null);
      try {
        const query = buildQuery({
          page: nextPage,
          pageSize: PAGE_SIZE,
          search: debouncedSearch || undefined,
          department: departmentFilter || undefined,
          status: statusFilter,
        });
        const res = await fetch(`${EMPLOYEES_ENDPOINT}?${query}`, {
          cache: "no-store",
          signal,
        });
        const json = (await res.json().catch(() => null)) as ApiResponse<EmployeeListResponse> | null;
        if (!res.ok || !json?.success || !json.data) {
          throw new Error(json?.error ?? "加载员工数据失败");
        }
        setItems(json.data.items);
        setTotal(json.data.total);
        setAvailableDepartments(json.data.availableDepartments ?? []);
        setPage(json.data.page);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error("加载员工数据失败", err);
        setError(err instanceof Error ? err.message : "加载员工数据失败，请稍后重试");
        setItems([]);
        setAvailableDepartments([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [debouncedSearch, departmentFilter, statusFilter]
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchEmployees(1, controller.signal);
    return () => controller.abort();
  }, [fetchEmployees]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / PAGE_SIZE)), [total]);

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages || nextPage === page) return;
    void fetchEmployees(nextPage);
  };

  const resetForm = () => {
    setFormOpen(false);
    setEditing(null);
    setFormSubmitting(false);
  };

  const handleCreate = async (values: EmployeeFormValues) => {
    setFormSubmitting(true);
    try {
      const res = await fetch(EMPLOYEES_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<EmployeeRecord> | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error ?? "创建员工失败");
      }
  await fetchEmployees(1);
  resetForm();
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUpdate = async (values: EmployeeFormValues) => {
    if (!editing) return;
    setFormSubmitting(true);
    try {
      const res = await fetch(`${EMPLOYEES_ENDPOINT}/${editing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<EmployeeRecord> | null;
      if (!res.ok || !json?.success || !json.data) {
        throw new Error(json?.error ?? "更新员工失败");
      }
  await fetchEmployees(page);
  resetForm();
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleDelete = async (employee: EmployeeRecord) => {
    const confirmed = window.confirm(`确定删除员工【${employee.displayName ?? employee.firstName}】吗？`);
    if (!confirmed) return;
    setDeletingId(employee.id);
    try {
      const res = await fetch(`${EMPLOYEES_ENDPOINT}/${employee.id}`, {
        method: "DELETE",
      });
      const json = (await res.json().catch(() => null)) as ApiResponse<unknown> | null;
      if (!res.ok || !json?.success) {
        throw new Error(json?.error ?? "删除员工失败");
      }
      const nextPage = Math.max(1, Math.min(page, Math.ceil((total - 1) / PAGE_SIZE)));
      await fetchEmployees(nextPage);
    } catch (err) {
      console.error("删除员工失败", err);
      alert(err instanceof Error ? err.message : "删除失败，请稍后重试");
    } finally {
      setDeletingId(null);
    }
  };

  const canManage = !authLoading && user?.role === "finance_admin";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] lg:flex-row lg:items-end lg:justify-between lg:p-6">
        <div className="flex flex-1 flex-col gap-4 lg:flex-row lg:items-end">
          <div className="flex-1">
            <Label>搜索员工</Label>
            <Input
              placeholder="输入姓名、邮箱或编号"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex-1">
            <Label>部门</Label>
            <select
              className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
              value={departmentFilter ?? ""}
              onChange={(event) => setDepartmentFilter(event.target.value ? event.target.value : null)}
            >
              <option value="" className="text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                全部部门
              </option>
              {availableDepartments.map((department) => (
                <option key={department} value={department} className="text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                  {department}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <Label>状态</Label>
            <select
              className="h-11 w-full appearance-none rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90 dark:focus:border-brand-800"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            >
              <option value="all" className="text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                全部状态
              </option>
              <option value="active" className="text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                在职
              </option>
              <option value="on_leave" className="text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                休假
              </option>
              <option value="terminated" className="text-gray-700 dark:bg-gray-900 dark:text-gray-300">
                离职
              </option>
            </select>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3">
          {canManage && (
            <Button
              type="button"
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              新增员工
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-error-200 bg-error-50 px-4 py-3 text-sm text-error-600 dark:border-error-500/40 dark:bg-error-500/10 dark:text-error-300">
          {error}
        </div>
      )}

      <EmployeeTable
        items={items}
        loading={loading}
        onEdit={(employee) => {
          if (!canManage) return;
          setEditing(employee);
          setFormOpen(true);
        }}
        onDelete={(employee) => {
          if (!canManage) return;
          void handleDelete(employee);
        }}
        deletingId={deletingId}
      />

      {total > PAGE_SIZE && (
        <div className="flex justify-end">
          <Pagination currentPage={page} totalPages={totalPages} onPageChange={handlePageChange} />
        </div>
      )}

      {!canManage && !authLoading && (
        <p className="text-sm text-gray-500 dark:text-gray-400">
          当前账号没有管理员权限，仅可查看员工信息。
        </p>
      )}

      <Modal isOpen={formOpen} onClose={resetForm} className="max-w-3xl p-6">
        <h3 className="mb-4 text-lg font-semibold text-gray-800 dark:text-white/90">
          {editing ? "编辑员工" : "新增员工"}
        </h3>
        <EmployeeForm
          key={editing ? editing.id : "new"}
          initialData={editing}
          onSubmit={editing ? handleUpdate : handleCreate}
          onCancel={resetForm}
          submitting={formSubmitting}
        />
      </Modal>
    </div>
  );
}
