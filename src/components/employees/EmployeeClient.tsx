'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Plus, RefreshCcw, Search, ChevronLeft, ChevronRight, Download, Upload, FileJson } from 'lucide-react';
import Papa from 'papaparse';
import EmployeeForm from './EmployeeForm';
import EmployeeStatusHistory from './EmployeeStatusHistory';
import EmployeeTable from './EmployeeTable';
import RoleAssignmentDialog, { type RoleAssignmentPayload } from './RoleAssignmentDialog';
import {
  DepartmentOption,
  Employee,
  EmployeeFilters,
  EmployeeFormSubmitPayload,
  EmployeeListResponse,
  EmployeeMutationResponse,
  EmploymentStatus,
  EMPLOYMENT_STATUS_LABELS,
  JobGradeOption,
  EmployeeBulkImportResponse,
  EmployeeBulkImportResult,
  EmployeeImportRow,
} from './types';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { useConfirm } from '@/hooks/useConfirm';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

const DEFAULT_FILTERS: EmployeeFilters = {
  search: '',
  department: null,
  departmentId: null,
  jobGradeId: null,
  status: 'all',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
};

const IMPORT_TEMPLATE = `[
  {
    "employeeCode": "EMP-001",
    "firstName": "晓华",
    "lastName": "王",
    "displayName": "王晓华",
    "email": "xiaohua@example.com",
    "departmentCode": "ENG",
    "jobTitle": "前端工程师",
    "jobGradeCode": "L3",
    "employmentStatus": "active",
    "hireDate": "2024-04-01"
  }
]`;

const CSV_HEADER_ALIASES: Record<string, keyof EmployeeImportRow> = {
  'id': 'id',
  'employee id': 'id',
  'employee_code': 'employeeCode',
  'employee code': 'employeeCode',
  '员工编号': 'employeeCode',
  '编号': 'employeeCode',
  '员工id': 'id',
  'first_name': 'firstName',
  'first name': 'firstName',
  '名': 'firstName',
  'last_name': 'lastName',
  'last name': 'lastName',
  '姓': 'lastName',
  'display_name': 'displayName',
  'display name': 'displayName',
  '昵称': 'displayName',
  '显示名称': 'displayName',
  '显示名': 'displayName',
  'email': 'email',
  '邮箱': 'email',
  'phone': 'phone',
  'mobile': 'phone',
  '手机号': 'phone',
  '电话': 'phone',
  'department': 'department',
  'department_name': 'department',
  '部门': 'department',
  '部门名称': 'department',
  'department_id': 'departmentId',
  '部门id': 'departmentId',
  'department code': 'departmentCode',
  'department_code': 'departmentCode',
  '部门编码': 'departmentCode',
  'job_title': 'jobTitle',
  'job title': 'jobTitle',
  '职位': 'jobTitle',
  'job_grade_id': 'jobGradeId',
  'job grade id': 'jobGradeId',
  'job_grade_code': 'jobGradeCode',
  'job grade code': 'jobGradeCode',
  '职级编码': 'jobGradeCode',
  '职级id': 'jobGradeId',
  'employment_status': 'employmentStatus',
  'status': 'employmentStatus',
  '员工状态': 'employmentStatus',
  'hire_date': 'hireDate',
  'hire date': 'hireDate',
  'entry date': 'hireDate',
  '入职日期': 'hireDate',
  'termination_date': 'terminationDate',
  'termination date': 'terminationDate',
  '离职日期': 'terminationDate',
  'manager_id': 'managerId',
  'manager id': 'managerId',
  'manager': 'managerId',
  '直属主管id': 'managerId',
  'location': 'location',
  '工作地点': 'location',
  '自定义字段': 'customFields',
};

type CsvSummary = {
  rows: number;
  recognizedHeaders: string[];
  ignoredHeaders: string[];
};

function normalizeHeaderKey(header: string | null | undefined) {
  if (!header) return '';
  return header.trim().toLowerCase();
}

function coerceStatus(value: unknown): EmploymentStatus | undefined {
  if (!value) return undefined;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === 'active' || normalized === '在职') return 'active';
  if (normalized === 'on_leave' || normalized === 'leave' || normalized === '休假') return 'on_leave';
  if (normalized === 'terminated' || normalized === '离职' || normalized === 'inactive') return 'terminated';
  return undefined;
}

function assignImportValue(target: EmployeeImportRow, field: keyof EmployeeImportRow, value: string) {
  (target as Record<keyof EmployeeImportRow, unknown>)[field] = value;
}

function summarizeHeaders(headers: string[]) {
  if (!headers.length) return '无';
  if (headers.length <= 6) return headers.join(', ');
  return `${headers.slice(0, 6).join(', ')} 等 ${headers.length} 列`;
}

async function parseCsvFile(file: File) {
  return new Promise<{
    rows: EmployeeImportRow[];
    recognizedHeaders: string[];
    ignoredHeaders: string[];
  }>((resolve, reject) => {
    Papa.parse<Record<string, unknown>>(file, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (result) => {
        if (result.errors?.length) {
          const blockingError = result.errors.find((err) => err.code !== 'TooFewFields' && err.code !== 'TooManyFields')
            ?? result.errors[0];
          if (blockingError) {
            reject(new Error(blockingError.message));
            return;
          }
        }

        const recognized = new Set<string>();
        const ignored = new Set<string>();
        const payload: EmployeeImportRow[] = [];

        for (const row of result.data) {
          const mapped: EmployeeImportRow = {};
          let hasValue = false;
          const customFields: Record<string, string> = {};

          for (const [key, rawValue] of Object.entries(row)) {
            const stringValue = typeof rawValue === 'string' ? rawValue.trim() : rawValue == null ? '' : String(rawValue).trim();
            if (!stringValue) continue;

            const normalizedKey = normalizeHeaderKey(key);

            if (normalizedKey.startsWith('custom.')) {
              const customKey = normalizedKey.replace('custom.', '');
              if (customKey) {
                customFields[customKey] = stringValue;
                recognized.add(key);
                hasValue = true;
              }
              continue;
            }

            const mappedField = CSV_HEADER_ALIASES[normalizedKey];
            if (!mappedField) {
              if (normalizedKey) {
                ignored.add(key);
              }
              continue;
            }

            if (mappedField === 'employmentStatus') {
              const status = coerceStatus(stringValue);
              if (status) {
                mapped[mappedField] = status;
                recognized.add(key);
                hasValue = true;
              } else {
                ignored.add(key);
              }
              continue;
            }

            assignImportValue(mapped, mappedField, stringValue);
            recognized.add(key);
            hasValue = true;
          }

          if (Object.keys(customFields).length > 0) {
            mapped.customFields = customFields;
          }

          if (hasValue) {
            payload.push(mapped);
          }
        }

        resolve({
          rows: payload,
          recognizedHeaders: Array.from(recognized),
          ignoredHeaders: Array.from(ignored),
        });
      },
      error: (error) => reject(error),
    });
  });
}

const STATUS_CARD_META: Record<EmploymentStatus, { accent: string; badge: string; description: string }> = {
  active: {
    accent: 'text-emerald-600 dark:text-emerald-300',
    badge: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-200',
    description: '当前在岗',
  },
  on_leave: {
    accent: 'text-amber-600 dark:text-amber-200',
    badge: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-200',
    description: '休假或请假',
  },
  terminated: {
    accent: 'text-rose-600 dark:text-rose-200',
    badge: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-200',
    description: '已离任',
  },
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
  if (filters.departmentId?.trim()) params.set('departmentId', filters.departmentId.trim());
  if (filters.jobGradeId?.trim()) params.set('jobGradeId', filters.jobGradeId.trim());
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.sortBy !== 'updatedAt') params.set('sortBy', filters.sortBy);
  if (filters.sortOrder !== 'desc') params.set('sortOrder', filters.sortOrder);
  params.set('page', String(page));
  params.set('pageSize', String(pageSize));
  return params.toString();
}

function buildExportQuery(filters: EmployeeFilters) {
  const params = new URLSearchParams();
  if (filters.search.trim()) params.set('search', filters.search.trim());
  if (filters.department?.trim()) params.set('department', filters.department.trim());
  if (filters.departmentId?.trim()) params.set('departmentId', filters.departmentId.trim());
  if (filters.jobGradeId?.trim()) params.set('jobGradeId', filters.jobGradeId.trim());
  if (filters.status !== 'all') params.set('status', filters.status);
  if (filters.sortBy !== 'updatedAt') params.set('sortBy', filters.sortBy);
  if (filters.sortOrder !== 'desc') params.set('sortOrder', filters.sortOrder);
  return params.toString();
}

export default function EmployeeClient({
  initialData = [],
  initialTotal = 0,
  initialPage = 1,
  initialPageSize = 20,
}: EmployeeClientProps) {
  const [filters, setFilters] = useState<EmployeeFilters>(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState(DEFAULT_FILTERS.search);
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
  const [departmentOptions, setDepartmentOptions] = useState<DepartmentOption[]>([]);
  const [jobGradeOptions, setJobGradeOptions] = useState<JobGradeOption[]>([]);
  const [statusHistoryRefreshSignal, setStatusHistoryRefreshSignal] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<EmployeeBulkImportResult | null>(null);
  const [csvSummary, setCsvSummary] = useState<CsvSummary | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvParsing, setCsvParsing] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<Employee | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const { loading: permissionLoading, hasPermission } = usePermissions();
  const confirm = useConfirm();
  const hasFetchedInitial = useRef(initialData.length > 0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchTermRef = useRef(DEFAULT_FILTERS.search);

  const permissionFlags = useMemo(() => {
    if (permissionLoading) {
      return {
        canViewEmployees: false,
        canCreateEmployee: false,
        canUpdateEmployee: false,
        canDeleteEmployee: false,
        canAssignRoles: false,
      };
    }

    return {
      canViewEmployees: hasPermission('USER_VIEW_ALL'),
      canCreateEmployee: hasPermission('USER_CREATE'),
      canUpdateEmployee: hasPermission('USER_UPDATE'),
      canDeleteEmployee: hasPermission('USER_DELETE'),
      canAssignRoles: hasPermission('USER_ASSIGN_ROLES'),
    };
  }, [hasPermission, permissionLoading]);

  const { canViewEmployees, canCreateEmployee, canUpdateEmployee, canDeleteEmployee, canAssignRoles } = permissionFlags;

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  useEffect(() => {
    if (!isFormOpen) return;
    if (canCreateEmployee || canUpdateEmployee) return;
    setIsFormOpen(false);
    setSelectedEmployee(null);
    setIsEditMode(false);
  }, [canCreateEmployee, canUpdateEmployee, isFormOpen]);

  useEffect(() => {
    setSearchInput(filters.search);
    lastSearchTermRef.current = filters.search.trim();
  }, [filters.search]);

  useEffect(() => {
    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!canViewEmployees) return;
    async function fetchDepartments() {
      try {
        const response = await fetch('/api/employees/departments');
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            setDepartmentOptions(data.data);
          }
        }
      } catch (err) {
        console.error('获取部门列表失败', err);
      }
    }
    fetchDepartments();
  }, [canViewEmployees]);

  useEffect(() => {
    if (!canViewEmployees) return;
    async function fetchJobGrades() {
      try {
        const response = await fetch('/api/employees/job-grades');
        if (response.ok) {
          const data = await response.json();
          if (data.success && Array.isArray(data.data)) {
            setJobGradeOptions(data.data);
          }
        }
      } catch (err) {
        console.error('获取职级列表失败', err);
      }
    }
    fetchJobGrades();
  }, [canViewEmployees]);

  const refreshList = useCallback(
    async (nextPage: number = page, nextPageSize: number = pageSize, nextFilters: EmployeeFilters = filters) => {
      if (!canViewEmployees) {
        setLoading(false);
        return;
      }
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
    [filters, page, pageSize, canViewEmployees]
  );

  const handleExportCsv = useCallback(async () => {
    if (!canViewEmployees || exporting) return;
    setExporting(true);
    try {
      const query = buildExportQuery(filters);
      const response = await fetch(`/api/employees/export?${query}&format=csv`, {
        headers: { Accept: 'text/csv' },
      });
      if (!response.ok) {
        throw new Error('导出失败，请稍后重试');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `employees-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出员工失败', error);
      alert(error instanceof Error ? error.message : '导出失败');
    } finally {
      setExporting(false);
    }
  }, [filters, canViewEmployees, exporting]);

  const handleDownloadTemplate = useCallback(() => {
    const blob = new Blob([IMPORT_TEMPLATE], { type: 'application/json;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'employee-import-template.json';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    window.URL.revokeObjectURL(url);
  }, []);

  const handleOpenImportDialog = useCallback(() => {
    setImportDialogOpen(true);
    setImportError(null);
    setImportResult(null);
    setCsvSummary(null);
    setCsvError(null);
  }, []);

  const handleImportDialogChange = useCallback((open: boolean) => {
    setImportDialogOpen(open);
    if (!open) {
      setImportText('');
      setImportError(null);
      setImportResult(null);
      setCsvSummary(null);
      setCsvError(null);
      setCsvParsing(false);
      if (csvInputRef.current) {
        csvInputRef.current.value = '';
      }
    }
  }, []);

  const handleCsvFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setCsvError(null);
    setImportError(null);
    setCsvSummary(null);
    setCsvParsing(true);
    try {
      const { rows, recognizedHeaders, ignoredHeaders } = await parseCsvFile(file);
      if (!rows.length) {
        setCsvError('CSV 文件未解析到有效数据');
        setImportText('');
        setImportResult(null);
        return;
      }
      setImportText(JSON.stringify(rows, null, 2));
      setImportResult(null);
      setCsvSummary({ rows: rows.length, recognizedHeaders, ignoredHeaders });
    } catch (error) {
      console.error('解析 CSV 失败', error);
      setCsvError(error instanceof Error ? error.message : 'CSV 解析失败');
      setCsvSummary(null);
    } finally {
      setCsvParsing(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  }, []);

  const handleImportSubmit = useCallback(async () => {
    if (!canCreateEmployee && !canUpdateEmployee) {
      setImportError('当前账户无权导入员工数据');
      return;
    }
    if (!importText.trim()) {
      setImportError('请粘贴或输入 JSON 数组');
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(importText);
    } catch {
      setImportError('JSON 格式无效');
      return;
    }
    if (!Array.isArray(parsed)) {
      setImportError('内容必须为数组');
      return;
    }
    if (parsed.length === 0) {
      setImportError('数组不能为空');
      return;
    }
    if (parsed.length > 500) {
      setImportError('一次最多导入 500 条记录');
      return;
    }

    setImporting(true);
    setImportError(null);
    try {
      const response = await fetch('/api/employees/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: parsed }),
      });
      const payload: EmployeeBulkImportResponse = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || '导入失败');
      }
      setImportResult(payload.data ?? null);
      setImportText('');
      await refreshList();
    } catch (error) {
      console.error('导入员工失败', error);
      setImportError(error instanceof Error ? error.message : '导入失败');
    } finally {
      setImporting(false);
    }
  }, [canCreateEmployee, canUpdateEmployee, importText, refreshList]);

  const handleSearch = useCallback(
    (nextFilters: Partial<EmployeeFilters>) => {
      if (!canViewEmployees) return;
      const mergedFilters = { ...filters, ...nextFilters };
      setFilters(mergedFilters);
      setPage(1);
      refreshList(1, pageSize, mergedFilters);
    },
    [filters, pageSize, refreshList, canViewEmployees]
  );

  const runSearchQuery = useCallback(
    (rawValue: string) => {
      if (!canViewEmployees) return;
      const trimmed = rawValue.trim();
      if (trimmed.length === 0) {
        lastSearchTermRef.current = '';
        handleSearch({ search: '' });
        return;
      }
      if (trimmed === lastSearchTermRef.current) {
        return;
      }
      lastSearchTermRef.current = trimmed;
      handleSearch({ search: trimmed });
    },
    [handleSearch, canViewEmployees]
  );

  const scheduleSearch = useCallback(
    (value: string) => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
      searchDebounceRef.current = setTimeout(() => {
        runSearchQuery(value);
      }, 450);
    },
    [runSearchQuery]
  );

  const handleSearchInputChange = useCallback(
    (value: string) => {
      setSearchInput(value);
      scheduleSearch(value);
    },
    [scheduleSearch]
  );

  const triggerImmediateSearch = useCallback(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
      searchDebounceRef.current = null;
    }
    runSearchQuery(searchInput);
  }, [runSearchQuery, searchInput]);

  const handlePageChange = useCallback(
    (direction: 'prev' | 'next') => {
      if (!canViewEmployees) return;
      const nextPage = direction === 'prev' ? Math.max(1, page - 1) : Math.min(totalPages, page + 1);
      if (nextPage === page) return;
      refreshList(nextPage);
    },
    [page, totalPages, refreshList, canViewEmployees]
  );

  const handlePageSizeChange = useCallback(
    (nextSize: number) => {
      if (!canViewEmployees) return;
      startTransition(() => {
        setPageSize(nextSize);
        setPage(1);
        refreshList(1, nextSize);
      });
    },
    [refreshList, canViewEmployees]
  );

  const handleCreate = useCallback(async (payload: EmployeeFormSubmitPayload) => {
    if (!canCreateEmployee) {
      alert('当前账户无权创建员工记录');
      return;
    }
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
  }, [refreshList, canCreateEmployee]);

  const handleUpdate = useCallback(
    async (payload: EmployeeFormSubmitPayload) => {
      if (!selectedEmployee) return;
      if (!canUpdateEmployee) {
        alert('当前账户无权更新员工记录');
        return;
      }
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
        if (data.data) {
          setSelectedEmployee(data.data);
        }
        setIsEditMode(false);
        setStatusHistoryRefreshSignal((value) => value + 1);
        refreshList();
      } catch (err) {
        console.error('更新员工失败', err);
        alert(err instanceof Error ? err.message : '更新失败');
      }
    },
    [selectedEmployee, refreshList, canUpdateEmployee]
  );

  const handleDelete = useCallback(
    async (employee: Employee) => {
      if (!canDeleteEmployee) {
        alert('当前账户无权删除员工记录');
        return;
      }
      const confirmed = await confirm({
        title: `确定删除员工 ${employee.displayName ?? employee.firstName}？`,
        description: '此操作无法撤销。',
        confirmText: '删除',
        cancelText: '取消',
      });
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
    [refreshList, canDeleteEmployee, confirm]
  );

  const handleEdit = useCallback(
    (employee: Employee) => {
      if (!canUpdateEmployee) {
        alert('当前账户无权编辑员工记录');
        return;
      }
      setSelectedEmployee(employee);
      setIsFormOpen(true);
      setIsEditMode(true);
    },
    [canUpdateEmployee]
  );

  const handleCreateClick = useCallback(() => {
    if (!canCreateEmployee) {
      alert('当前账户无权创建员工记录');
      return;
    }
    setSelectedEmployee(null);
    setIsEditMode(false);
    setIsFormOpen(true);
  }, [canCreateEmployee]);

  const handleDialogClose = useCallback(() => {
    setIsFormOpen(false);
    setSelectedEmployee(null);
    setIsEditMode(false);
  }, []);

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        handleDialogClose();
        return;
      }
      setIsFormOpen(true);
    },
    [handleDialogClose]
  );

  const handleRoleAssignClick = useCallback(
    (employee: Employee) => {
      if (!canAssignRoles) {
        alert('当前账户无权设置角色');
        return;
      }
      if (!employee.userId) {
        alert('该员工尚未绑定系统账号，无法设置角色');
        return;
      }
      setRoleTarget(employee);
      setRoleDialogOpen(true);
    },
    [canAssignRoles]
  );

  const handleRoleDialogChange = useCallback((open: boolean) => {
    setRoleDialogOpen(open);
    if (!open) {
      setRoleTarget(null);
    }
  }, []);

  const handleRoleSubmit = useCallback(
    async ({ roles, primaryRole }: RoleAssignmentPayload) => {
      if (!roleTarget) return;
      if (!canAssignRoles) {
        alert('当前账户无权设置角色');
        return;
      }
      setRoleSaving(true);
      try {
        const response = await fetch(`/api/employees/${roleTarget.id}/roles`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ roles, primaryRole }),
        });
        const payload: EmployeeMutationResponse = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || '设置角色失败');
        }
        const updated = payload.data;
        if (updated) {
          setEmployees((prev) => prev.map((emp) => (emp.id === updated.id ? updated : emp)));
          if (selectedEmployee?.id === updated.id) {
            setSelectedEmployee(updated);
          }
        }
        await refreshList();
        setRoleDialogOpen(false);
        setRoleTarget(null);
      } catch (error) {
        console.error('设置角色失败', error);
        alert(error instanceof Error ? error.message : '设置角色失败');
      } finally {
        setRoleSaving(false);
      }
    },
    [roleTarget, canAssignRoles, selectedEmployee, refreshList]
  );

  const handleLoadExample = useCallback(() => {
    setImportText(IMPORT_TEMPLATE);
    setCsvSummary(null);
    setCsvError(null);
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
  }, []);

  useEffect(() => {
    if (permissionLoading || !canViewEmployees) {
      return;
    }
    if (hasFetchedInitial.current) {
      return;
    }
    hasFetchedInitial.current = true;
    refreshList(initialPage, initialPageSize, DEFAULT_FILTERS).catch((err) => {
      console.error('初始化员工列表失败', err);
      hasFetchedInitial.current = false;
    });
  }, [permissionLoading, canViewEmployees, initialPage, initialPageSize, refreshList]);

  const activeCount = useMemo(() => employees.filter((emp) => emp.employmentStatus === 'active').length, [employees]);
  const onLeaveCount = useMemo(() => employees.filter((emp) => emp.employmentStatus === 'on_leave').length, [employees]);
  const terminatedCount = useMemo(() => employees.filter((emp) => emp.employmentStatus === 'terminated').length, [employees]);

  const renderSummaryChip = (status: EmploymentStatus, count: number) => {
    const meta = STATUS_CARD_META[status];
    return (
      <div
        key={status}
        className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1 text-[11px] text-muted-foreground"
      >
        <span className="font-medium text-foreground">{EMPLOYMENT_STATUS_LABELS[status]}</span>
        <span className={cn('font-semibold', meta.accent)}>{count}</span>
        <span className="text-[10px] text-muted-foreground/80">{meta.description}</span>
      </div>
    );
  };

  if (permissionLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
        正在加载权限信息...
      </div>
    );
  }

  if (!canViewEmployees) {
    return (
      <div className="rounded-lg border border-amber-200 bg-white p-6 text-sm text-amber-600 shadow-sm dark:border-amber-900/60 dark:bg-gray-900 dark:text-amber-200">
        当前账户无权访问员工模块，请联系管理员或系统管理员开通 USER_VIEW_ALL 权限。
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-3 rounded-lg border border-border/60 bg-card/90 p-3 shadow-sm md:space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="employee-search"
              value={searchInput}
              onChange={(event) => handleSearchInputChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  triggerImmediateSearch();
                }
              }}
              placeholder="按姓名、邮箱、电话模糊检索"
              className="h-9 pl-10 text-sm"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refreshList()}
              disabled={loading || isPending}
              className="gap-1"
            >
              <RefreshCcw className="h-4 w-4" /> 刷新
            </Button>
            {canViewEmployees && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="gap-1" disabled={exporting}>
                    <Download className="h-4 w-4" /> 批量操作
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuLabel>员工批量操作</DropdownMenuLabel>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      handleExportCsv();
                    }}
                    className="cursor-pointer"
                  >
                    <Download className="mr-2 h-4 w-4" /> 导出 CSV
                  </DropdownMenuItem>
                  {(canCreateEmployee || canUpdateEmployee) && (
                    <DropdownMenuItem
                      onSelect={(event) => {
                        event.preventDefault();
                        handleOpenImportDialog();
                      }}
                      className="cursor-pointer"
                    >
                      <Upload className="mr-2 h-4 w-4" /> 批量导入
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault();
                      handleDownloadTemplate();
                    }}
                    className="cursor-pointer"
                  >
                    <FileJson className="mr-2 h-4 w-4" /> 下载 JSON 模板
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            {canCreateEmployee && (
              <Button type="button" size="sm" onClick={handleCreateClick} className="gap-1">
                <Plus className="h-4 w-4" /> 新增
              </Button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <Select
            value={filters.departmentId ?? 'all'}
            onValueChange={(value) =>
              handleSearch({
                departmentId: value === 'all' ? null : value,
                department: null,
              })
            }
          >
            <SelectTrigger className="h-9 min-w-[140px] flex-1 border-border/80 text-xs">
              <SelectValue placeholder="全部部门" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部部门</SelectItem>
              {departmentOptions.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filters.jobGradeId ?? 'all'}
            onValueChange={(value) =>
              handleSearch({
                jobGradeId: value === 'all' ? null : value,
              })
            }
          >
            <SelectTrigger className="h-9 min-w-[140px] flex-1 border-border/80 text-xs">
              <SelectValue placeholder="全部职级" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部职级</SelectItem>
              {jobGradeOptions.map((grade) => (
                <SelectItem key={grade.id} value={grade.id}>
                  {grade.name}
                  {grade.level != null ? ` (L${grade.level})` : ''}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filters.status} onValueChange={(value) => handleSearch({ status: value as EmployeeFilters['status'] })}>
            <SelectTrigger className="h-9 min-w-[120px] flex-1 border-border/80 text-xs">
              <SelectValue placeholder="全部状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">在职</SelectItem>
              <SelectItem value="on_leave">休假</SelectItem>
              <SelectItem value="terminated">已离职</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={filters.sortBy}
            onValueChange={(value) => handleSearch({ sortBy: value as EmployeeFilters['sortBy'] })}
          >
            <SelectTrigger className="h-9 min-w-[140px] flex-1 border-border/80 text-xs">
              <SelectValue placeholder="排序字段" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="updatedAt">按更新时间</SelectItem>
              <SelectItem value="createdAt">按创建时间</SelectItem>
              <SelectItem value="lastName">按姓名</SelectItem>
              <SelectItem value="department">按部门</SelectItem>
              <SelectItem value="status">按状态</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-wrap gap-1 text-[10px] text-muted-foreground">
          {renderSummaryChip('active', activeCount)}
          {renderSummaryChip('on_leave', onLeaveCount)}
          {renderSummaryChip('terminated', terminatedCount)}
        </div>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        <EmployeeTable
          employees={employees}
          loading={loading || isPending}
          onEdit={handleEdit}
          onDelete={handleDelete}
          canEdit={canUpdateEmployee}
          canDelete={canDeleteEmployee}
          onAssignRoles={canAssignRoles ? handleRoleAssignClick : undefined}
          canAssignRoles={canAssignRoles}
        />

        <div className="flex flex-col gap-3 border-t border-border/80 px-6 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div>共 {total} 人 • 第 {page} / {totalPages} 页</div>
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <Select value={String(pageSize)} onValueChange={(value) => handlePageSizeChange(Number(value))}>
              <SelectTrigger className="h-9 w-[140px]">
                <SelectValue placeholder="每页数量" />
              </SelectTrigger>
              <SelectContent>
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    每页 {size} 条
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePageChange('prev')}
                disabled={page <= 1}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" /> 上一页
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handlePageChange('next')}
                disabled={page >= totalPages}
                className="gap-1"
              >
                下一页 <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      <RoleAssignmentDialog
        open={roleDialogOpen}
        employee={roleTarget}
        saving={roleSaving}
        onOpenChange={handleRoleDialogChange}
        onSubmit={handleRoleSubmit}
      />

      <Sheet open={isFormOpen} onOpenChange={handleDialogOpenChange}>
        <SheetContent side="right" className="max-w-3xl">
          <SheetHeader className="border-b border-border/60 pb-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <SheetTitle>
                  {isEditMode
                    ? `编辑员工: ${selectedEmployee?.displayName ?? selectedEmployee?.firstName ?? ''}`
                    : selectedEmployee
                      ? '员工详情'
                      : '新增员工'}
                </SheetTitle>
                <SheetDescription>
                  {isEditMode
                    ? '更新员工档案信息，保存后立即生效'
                    : selectedEmployee
                      ? '查看员工基础信息，如需调整请切换到编辑模式'
                      : '填写入职信息后提交创建新的员工记录'}
                </SheetDescription>
              </div>
              <div className="flex gap-2">
                {selectedEmployee && !isEditMode && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                    编辑
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={handleDialogClose}>
                  关闭
                </Button>
              </div>
            </div>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto">
            {isFormOpen && (
              <div className="space-y-6">
                <EmployeeForm
                  initialData={selectedEmployee}
                  onSubmit={selectedEmployee ? handleUpdate : handleCreate}
                  onCancel={handleDialogClose}
                  departmentOptions={departmentOptions}
                  jobGradeOptions={jobGradeOptions}
                />
                {selectedEmployee && (
                  <EmployeeStatusHistory
                    employeeId={selectedEmployee.id}
                    refreshSignal={statusHistoryRefreshSignal}
                  />
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={importDialogOpen} onOpenChange={handleImportDialogChange}>
        <SheetContent side="right" className="max-w-3xl">
          <SheetHeader>
            <SheetTitle>批量导入员工</SheetTitle>
            <SheetDescription>
              支持粘贴 JSON 数组或上传 CSV 文件，字段与单条新增员工一致，支持通过 departmentId 或 departmentCode、jobGradeId 或
              jobGradeCode 进行关联。
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto">
            <div className="space-y-3 rounded-lg border border-dashed border-border/70 bg-muted/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1 text-xs text-muted-foreground">
                  <p className="text-sm font-medium text-foreground">上传 CSV 文件</p>
                  <p>首行必须包含字段名，系统会匹配常见列名并自动转换状态、日期、部门等字段。</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    ref={csvInputRef}
                    type="file"
                    accept=".csv,text/csv"
                    className="hidden"
                    onChange={handleCsvFileChange}
                  />
                  <Button type="button" variant="outline" size="sm" onClick={() => csvInputRef.current?.click()} disabled={csvParsing}>
                    {csvParsing ? <RefreshCcw className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />} {csvParsing ? '解析中...' : '选择 CSV'}
                  </Button>
                </div>
              </div>
              {csvError && (
                <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                  {csvError}
                </div>
              )}
              {csvSummary && (
                <div className="rounded-md border border-border/50 bg-background/70 px-3 py-2 text-xs text-muted-foreground">
                  <p>
                    已解析 <span className="font-medium text-foreground">{csvSummary.rows}</span> 条记录，识别列：
                    {summarizeHeaders(csvSummary.recognizedHeaders)}。
                  </p>
                  {csvSummary.ignoredHeaders.length > 0 && (
                    <p>未识别列：{summarizeHeaders(csvSummary.ignoredHeaders)}</p>
                  )}
                </div>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>最多一次导入 500 条，可在下方调整解析后的 JSON，系统会根据员工编号 / 邮箱匹配已有记录。</span>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={handleLoadExample}
              >
                载入示例
              </Button>
            </div>
            <Textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder={IMPORT_TEMPLATE}
              rows={12}
              className="font-mono text-xs"
            />
            {importError && (
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-200">
                {importError}
              </div>
            )}
            {importResult && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200">
                <p>
                  新增 {importResult.created} 条，更新 {importResult.updated} 条，跳过 {importResult.skipped} 条。
                </p>
                {importResult.errors?.length ? (
                  <div className="mt-2 space-y-1 text-[11px] text-emerald-900/80 dark:text-emerald-100">
                    {importResult.errors?.slice(0, 3).map((err: NonNullable<EmployeeBulkImportResponse['data']>['errors'][number]) => (
                      <p key={`${err.index}-${err.message}`}>
                        第 {err.index + 1} 行：{err.identifier ? `${err.identifier} - ` : ''}{err.message}
                      </p>
                    ))}
                    {importResult.errors && importResult.errors.length > 3 && (
                      <p>其余 {importResult.errors.length - 3} 条请查看接口响应。</p>
                    )}
                  </div>
                ) : null}
              </div>
            )}
          </div>
          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => handleImportDialogChange(false)}>
              取消
            </Button>
            <Button type="button" onClick={handleImportSubmit} disabled={importing} className="gap-1">
              {importing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? '导入中...' : '开始导入'}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/60 dark:text-rose-200">
          {error}
        </div>
      )}
    </div>
  );
}
