'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import EmployeeForm from './EmployeeForm';
import EmployeeTable from './EmployeeTable';
import {
  Employee,
  EmployeeFilters,
  EmployeeFormSubmitPayload,
  EmployeeListResponse,
  EmployeeMutationResponse,
  EmploymentStatus,
  EMPLOYMENT_STATUS_LABELS,
} from './types';

const DEFAULT_FILTERS: EmployeeFilters = {
  search: '',
  department: null,
  status: 'all',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
};

type EmployeeClientProps = {
  initialData?: Employee[];
  initialTotal?: number;
  initialPage?: number;
  initialPageSize?: number;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function buildQuery(filters: EmployeeFilters, page: number, pageSize: number) {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.department?.trim()) params.set('department', filters.department.trim());
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.sortBy !== 'updatedAt') params.set('sortBy', filters.sortBy);
  if (filters.sortOrder !== 'desc') params.set('sortOrder', filters.sortOrder);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  return params.toString();
}

export default function EmployeeClient({
  initialData = [],
  initialTotal = 0,
  initialPage = 1,
  initialPageSize = 20,
}: EmployeeClientProps) {
  const [filters, setFilters] = useState<EmployeeFilters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [employees, setEmployees] = useState<Employee[]>(initialData);
  const [total, setTotal] = useState(initialTotal);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [departments, setDepartments] = useState<string[]>([]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  useEffect(() => {
    async function fetchDepartments() {
      try {
        const response = await fetch('/api/employees/departments');
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            setDepartments(data.data);
          }
        }
      } catch (err) {
        console.error('获取部门列表失败', err);
      }
    }
    fetchDepartments();
  }, []);

  const refreshList = useCallback(
    async (nextPage: number = page, nextPageSize: number = pageSize, nextFilters: EmployeeFilters = filters) => {
      const query = buildQuery(nextFilters, nextPage, nextPageSize);
      setLoading(true);
      setError(null);
      try {
        const response = await fetch(`/api/employees?${query}`, {
          headers: { Accept: 'application/json' },
        });
        if (!response.ok) {
          throw new Error('列表加载失败');
        }
        const payload: EmployeeListResponse = await response.json();
        if (!payload.success || !payload.data) {
          throw new Error(payload.error || '获取数据失败');
        }
        const { items, total: count, page: resPage, pageSize: resPageSize } = payload.data;
        setEmployees(items);
        setTotal(count);
        setPage(resPage);
        setPageSize(resPageSize);
      } catch (err) {
        console.error('加载员工列表失败', err);
        setError(err instanceof Error ? err.message : '未知错误');
      } finally {
        setLoading(false);
      }
    },
    [filters, page, pageSize]
  );

  const handleSearch = useCallback(
    (nextFilters: Partial<EmployeeFilters>) => {
      startTransition(() => {
        setFilters((prev) => ({ ...prev, ...nextFilters }));
        setPage(1);
        refreshList(1, pageSize, { ...filters, ...nextFilters });
      });
    },
    [filters, pageSize, refreshList]
  );

  const handlePageChange = useCallback(
    (direction: 'prev' | 'next') => {
      const nextPage = direction === 'prev' ? Math.max(1, page - 1) : Math.min(totalPages, page + 1);
      if (nextPage === page) return;
      refreshList(nextPage);
    },
    [page, totalPages, refreshList]
  );

  const handlePageSizeChange = useCallback(
    (nextSize: number) => {
      startTransition(() => {
        setPageSize(nextSize);
        setPage(1);
        refreshList(1, nextSize);
      });
    },
    [refreshList]
  );

  const handleCreate = useCallback(async (payload: EmployeeFormSubmitPayload) => {
    try {
      const response = await fetch('/api/employees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data: EmployeeMutationResponse = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(data.error || '创建失败');
      }
      setIsFormOpen(false);
      refreshList();
    } catch (err) {
      console.error('创建员工失败', err);
      alert(err instanceof Error ? err.message : '创建失败');
    }
  }, [refreshList]);

  const handleUpdate = useCallback(
    async (payload: EmployeeFormSubmitPayload) => {
      if (!selectedEmployee) return;
      try {
        const response = await fetch(`/api/employees/${selectedEmployee.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data: EmployeeMutationResponse = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || '更新失败');
        }
        setIsFormOpen(false);
        setSelectedEmployee(null);
        setIsEditMode(false);
        refreshList();
      } catch (err) {
        console.error('更新员工失败', err);
        alert(err instanceof Error ? err.message : '更新失败');
      }
    },
    [selectedEmployee, refreshList]
  );

  const handleDelete = useCallback(
    async (employee: Employee) => {
      const confirmed = window.confirm(`确定删除员工 ${employee.displayName ?? employee.firstName}?`);
      if (!confirmed) return;
      try {
        const response = await fetch(`/api/employees/${employee.id}`, { method: 'DELETE' });
        const data: EmployeeMutationResponse = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || '删除失败');
        }
        refreshList();
      } catch (err) {
        console.error('删除员工失败', err);
        alert(err instanceof Error ? err.message : '删除失败');
      }
    },
    [refreshList]
  );

  const handleEdit = useCallback((employee: Employee) => {
      setSelectedEmployee(employee);
      setIsFormOpen(true);
      setIsEditMode(true);
  }, []);

  const handleCreateClick = useCallback(() => {
    setSelectedEmployee(null);
    setIsEditMode(false);
    setIsFormOpen(true);
  }, []);

  useEffect(() => {
    if (initialData.length === 0) {
      refreshList(initialPage, initialPageSize, DEFAULT_FILTERS).catch((err) => {
        console.error('初始化员工列表失败', err);
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const activeCount = useMemo(() => employees.filter((emp) => emp.employmentStatus === 'active').length, [employees]);
  const onLeaveCount = useMemo(() => employees.filter((emp) => emp.employmentStatus === 'on_leave').length, [employees]);
  const terminatedCount = useMemo(() => employees.filter((emp) => emp.employmentStatus === 'terminated').length, [employees]);

  const renderSummaryCard = (status: EmploymentStatus, count: number) => (
    <div key={status} className="rounded-lg border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-900">
      <div className="text-sm text-gray-500 dark:text-gray-400">{EMPLOYMENT_STATUS_LABELS[status]}</div>
      <div className="mt-2 text-2xl font-semibold text-gray-900 dark:text-gray-100">{count}</div>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-lg border border-gray-200 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-gray-100">员工管理</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              维护员工档案、跟进状态并快速检索直属团队成员。
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => refreshList()}
              disabled={loading || isPending}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-300"
            >
              刷新
            </button>
            <button
              onClick={handleCreateClick}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 dark:bg-blue-500 dark:hover:bg-blue-600"
            >
              + 新增员工
            </button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <label className="sr-only" htmlFor="employee-search">搜索</label>
            <input
              id="employee-search"
              value={filters.search}
              onChange={(event) => handleSearch({ search: event.target.value })}
              placeholder="按姓名、邮箱、电话模糊检索"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            />
          </div>
          <div>
            <select
              value={filters.department ?? ''}
              onChange={(event) => handleSearch({ department: event.target.value || null })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="">全部部门</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>
          <div>
            <select
              value={filters.status}
              onChange={(event) => handleSearch({ status: event.target.value as EmployeeFilters['status'] })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="all">全部状态</option>
              <option value="active">在职</option>
              <option value="on_leave">休假</option>
              <option value="terminated">已离职</option>
            </select>
          </div>
          <div>
            <select
              value={filters.sortBy}
              onChange={(event) => handleSearch({ sortBy: event.target.value as EmployeeFilters['sortBy'] })}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
            >
              <option value="updatedAt">按更新时间</option>
              <option value="createdAt">按创建时间</option>
              <option value="lastName">按姓名</option>
              <option value="department">按部门</option>
              <option value="status">按状态</option>
            </select>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {renderSummaryCard('active', activeCount)}
          {renderSummaryCard('on_leave', onLeaveCount)}
          {renderSummaryCard('terminated', terminatedCount)}
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <EmployeeTable
          employees={employees}
          loading={loading || isPending}
          onEdit={handleEdit}
              onDelete={handleDelete}
        />

        <div className="flex items-center justify-between border-t border-gray-100 px-6 py-3 text-sm text-gray-600 dark:border-gray-800 dark:text-gray-300">
          <div>
            共 {total} 人 • 第 {page} / {totalPages} 页
          </div>
          <div className="flex items-center gap-3">
            <select
              value={pageSize}
              onChange={(event) => handlePageSizeChange(Number(event.target.value))}
              className="rounded border border-gray-300 bg-white px-2 py-1 text-sm focus:border-blue-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800"
            >
              {PAGE_SIZE_OPTIONS.map((size) => (
                <option key={size} value={size}>
                  每页 {size} 条
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <button
                onClick={() => handlePageChange('prev')}
                disabled={page <= 1}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800"
              >
                上一页
              </button>
              <button
                onClick={() => handlePageChange('next')}
                disabled={page >= totalPages}
                className="rounded border border-gray-300 px-3 py-1 text-sm hover:bg-gray-100 disabled:opacity-50 dark:border-gray-600 dark:bg-gray-800"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-3xl rounded-xl bg-white p-6 shadow-xl dark:bg-gray-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  {isEditMode
                    ? `编辑员工: ${selectedEmployee?.displayName ?? selectedEmployee?.firstName ?? ''}`
                    : selectedEmployee
                      ? '员工详情'
                      : '新增员工'}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {isEditMode
                    ? '更新员工档案信息，保存后立即生效'
                    : selectedEmployee
                      ? '查看员工基础信息，如需调整请切换到编辑模式'
                      : '填写入职信息后提交创建新的员工记录'}
                </p>
              </div>
              <div className="flex gap-2">
                {selectedEmployee && !isEditMode && (
                  <button
                    onClick={() => setIsEditMode(true)}
                    className="rounded border border-blue-500 px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 dark:border-blue-400 dark:text-blue-300"
                  >
                    编辑
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsFormOpen(false);
                    setSelectedEmployee(null);
                    setIsEditMode(false);
                  }}
                  className="rounded border border-gray-300 px-3 py-1 text-sm text-gray-600 hover:bg-gray-100 dark:border-gray-700 dark:text-gray-300"
                >
                  关闭
                </button>
              </div>
            </div>
            <EmployeeForm
              initialData={selectedEmployee}
                    onSubmit={selectedEmployee ? handleUpdate : handleCreate}
              onCancel={() => {
                setIsFormOpen(false);
                setSelectedEmployee(null);
                setIsEditMode(false);
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-200">
          {error}
        </div>
      )}
    </div>
  );
}
