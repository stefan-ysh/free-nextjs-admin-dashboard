'use client';

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Plus, RefreshCcw, Search, Download, Upload, FileJson } from 'lucide-react';
import { toast } from 'sonner';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Papa from 'papaparse';
import EmployeeForm from './EmployeeForm';
import EmployeeStatusHistory from './EmployeeStatusHistory';
import EmployeeTable from './EmployeeTable';
import Pagination from '@/components/tables/Pagination';
import RoleAssignmentDialog, { type RoleAssignmentPayload } from './RoleAssignmentDialog';
import ResetPasswordDialog from './ResetPasswordDialog';
import CredentialsDialog from './CredentialsDialog';
import {
  Employee,
  EmployeeFilters,
  EmployeeFormSubmitPayload,
  EmployeeListResponse,
  EmployeeMutationResponse,
  EmploymentStatus,
  EMPLOYMENT_STATUS_LABELS,
  EmployeeBulkImportResponse,
  EmployeeBulkImportResult,
  EmployeeImportRow,
} from './types';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';
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
import { formatDateOnly } from '@/lib/dates';
import {
  FORM_DRAWER_WIDTH_STANDARD,
  FORM_DRAWER_WIDTH_WIDE,
} from '@/components/common/form-drawer-width';

const DEFAULT_FILTERS: EmployeeFilters = {
  search: '',
  status: 'all',
  sortBy: 'updatedAt',
  sortOrder: 'desc',
};

const IMPORT_TEMPLATE = `[
  {
    "employeeCode": "EMP-001",
    "displayName": "王晓华",
    "email": "xiaohua@example.com",
    "initialPassword": "Welcome123",
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
  'name': 'displayName',
  'full_name': 'displayName',
  'full name': 'displayName',
  '姓名': 'displayName',
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
  'initial_password': 'initialPassword',
  'initial password': 'initialPassword',
  '初始密码': 'initialPassword',
  '默认密码': 'initialPassword',
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
    accent: 'text-chart-5',
    badge: 'bg-chart-5/15 text-chart-5',
    description: '当前在岗',
  },
  on_leave: {
    accent: 'text-chart-3',
    badge: 'bg-chart-3/20 text-chart-3',
    description: '休假或请假',
  },
  terminated: {
    accent: 'text-destructive',
    badge: 'bg-destructive/15 text-destructive',
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
  const [filterDrawerOpen, setFilterDrawerOpen] = useState(false);
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
  const [statusHistoryRefreshSignal, setStatusHistoryRefreshSignal] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<EmployeeBulkImportResult | null>(null);
  const [importDefaultPassword, setImportDefaultPassword] = useState('');
  const [importUseCodePassword, setImportUseCodePassword] = useState(false);
  const [csvSummary, setCsvSummary] = useState<CsvSummary | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [csvParsing, setCsvParsing] = useState(false);
  const [roleDialogOpen, setRoleDialogOpen] = useState(false);
  const [roleTarget, setRoleTarget] = useState<Employee | null>(null);
  const [roleSaving, setRoleSaving] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetTarget, setResetTarget] = useState<Employee | null>(null);
  const [resetSaving, setResetSaving] = useState(false);
  const [credentialsOpen, setCredentialsOpen] = useState(false);
  const [credentialsAccounts, setCredentialsAccounts] = useState<Array<{ label: string; value: string }>>([]);
  const [credentialsPassword, setCredentialsPassword] = useState('');
  const [autoBindingEmployeeId, setAutoBindingEmployeeId] = useState<string | null>(null);
  const csvInputRef = useRef<HTMLInputElement | null>(null);
  const { hasPermission, loading: permissionLoading } = usePermissions();
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const confirm = useConfirm();
  const hasFetchedInitial = useRef(initialData.length > 0);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSearchTermRef = useRef(DEFAULT_FILTERS.search);

  useEffect(() => {
    if (credentialsOpen) return;
    if (credentialsPassword || credentialsAccounts.length) {
      setCredentialsPassword('');
      setCredentialsAccounts([]);
    }
  }, [credentialsOpen, credentialsPassword, credentialsAccounts]);


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
      const today = formatDateOnly(new Date()) ?? new Date().toISOString().slice(0, 10);
      anchor.download = `employees-${today}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('导出员工失败', error);
      toast.error(error instanceof Error ? error.message : '导出失败');
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
      setImportDefaultPassword('');
      setImportUseCodePassword(false);
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
        body: JSON.stringify({
          items: parsed,
          options: {
            defaultInitialPassword: importDefaultPassword.trim() || undefined,
            useEmployeeCodeAsPassword: importUseCodePassword || undefined,
          },
        }),
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
  }, [canCreateEmployee, canUpdateEmployee, importText, refreshList, importDefaultPassword, importUseCodePassword]);

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

  const handleResetFilters = useCallback(() => {
    if (!canViewEmployees) return;
    setSearchInput('');
    lastSearchTermRef.current = '';
    setFilters(DEFAULT_FILTERS);
    setPage(1);
    refreshList(1, pageSize, DEFAULT_FILTERS);
  }, [canViewEmployees, pageSize, refreshList]);

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
    (nextPage: number) => {
      if (!canViewEmployees) return;
      if (nextPage === page) return;
      refreshList(nextPage);
    },
    [page, refreshList, canViewEmployees]
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
      toast.error('当前账户无权创建员工记录');
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
      toast.success('员工创建成功');
      const created = data.data;
      const accounts: Array<{ label: string; value: string }> = [];
      if (created?.email) {
        accounts.push({ label: '邮箱', value: created.email });
      }
      if (created?.phone) {
        accounts.push({ label: '手机号', value: created.phone });
      }
      if (created?.employeeCode) {
        accounts.push({ label: '员工编号', value: created.employeeCode });
      }
      if (payload.initialPassword) {
        setCredentialsAccounts(accounts);
        setCredentialsPassword(payload.initialPassword);
        setCredentialsOpen(true);
      }
      setIsFormOpen(false);
      refreshList();
    } catch (err) {
      console.error('创建员工失败', err);
      toast.error(err instanceof Error ? err.message : '创建失败');
    }
  }, [refreshList, canCreateEmployee]);

  const handleUpdate = useCallback(
    async (payload: EmployeeFormSubmitPayload) => {
      if (!selectedEmployee) return;
      if (!canUpdateEmployee) {
        toast.error('当前账户无权更新员工记录');
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
        setIsEditMode(false);
        setStatusHistoryRefreshSignal((value) => value + 1);
        toast.success('员工信息更新成功');
        refreshList();
      } catch (err) {
        console.error('更新员工失败', err);
        toast.error(err instanceof Error ? err.message : '更新失败');
      }
    },
    [selectedEmployee, refreshList, canUpdateEmployee]
  );

  const handleDelete = useCallback(
    async (employee: Employee) => {
      if (!canDeleteEmployee) {
        toast.error('当前账户无权删除员工记录');
        return;
      }
      const confirmed = await confirm({
        title: `确定删除员工 ${employee.displayName ?? employee.email ?? employee.employeeCode ?? ''}？`,
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
        if (!response.ok || !data.success) {
          throw new Error(data.error || '删除失败');
        }
        toast.success('员工已删除');
        refreshList();
      } catch (err) {
        console.error('删除员工失败', err);
        toast.error(err instanceof Error ? err.message : '删除失败');
      }
    },
    [refreshList, canDeleteEmployee, confirm]
  );

  const handleEdit = useCallback(
    (employee: Employee) => {
      if (!canUpdateEmployee) {
        toast.error('当前账户无权编辑员工记录');
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
      toast.error('当前账户无权创建员工记录');
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

  const autoBindAndOpenRoles = useCallback(
    async (employee: Employee) => {
      setAutoBindingEmployeeId(employee.id);
      try {
        const response = await fetch('/api/employees/auto-bind', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employeeId: employee.id }),
        });
        const payload = await response.json();
        if (!response.ok || !payload.success || !payload.data?.userId) {
          throw new Error(payload.error || '无法自动生成账号');
        }
        const updatedEmployee: Employee = {
          ...employee,
          userId: payload.data.userId,
        };
        setEmployees((prev) => prev.map((item) => (item.id === employee.id ? updatedEmployee : item)));
        if (selectedEmployee?.id === employee.id) {
          setSelectedEmployee(updatedEmployee);
        }
        toast.success('已为该员工生成系统账号', {
          description: `账号：${payload.data.loginAccount}（初始密码同账号）`,
        });
        setRoleTarget(updatedEmployee);
        setRoleDialogOpen(true);
      } catch (bindingError) {
        console.error('自动绑定系统账号失败', bindingError);
        toast.error(bindingError instanceof Error ? bindingError.message : '无法自动生成账号，请稍后再试');
      } finally {
        setAutoBindingEmployeeId(null);
      }
    },
    [selectedEmployee]
  );

  const handleRoleAssignClick = useCallback(
    (employee: Employee) => {
      if (!canAssignRoles) {
        toast.error('当前账户无权设置角色');
        return;
      }
      if (!employee.userId) {
        if (autoBindingEmployeeId && autoBindingEmployeeId !== employee.id) {
          toast.warning('正在为其他员工生成账号，请稍后重试');
          return;
        }
        if (autoBindingEmployeeId === employee.id) {
          toast('正在生成账号，请稍候...');
          return;
        }
        void autoBindAndOpenRoles(employee);
        return;
      }
      setRoleTarget(employee);
      setRoleDialogOpen(true);
    },
    [canAssignRoles, autoBindingEmployeeId, autoBindAndOpenRoles]
  );

  const handleRoleDialogChange = useCallback((open: boolean) => {
    setRoleDialogOpen(open);
    if (!open) {
      setRoleTarget(null);
    }
  }, []);

  const handleResetPasswordClick = useCallback(
    (employee: Employee) => {
      if (!canUpdateEmployee) {
        toast.error('当前账户无权重置密码');
        return;
      }
      setResetTarget(employee);
      setResetDialogOpen(true);
    },
    [canUpdateEmployee]
  );

  const handleResetDialogChange = useCallback((open: boolean) => {
    setResetDialogOpen(open);
    if (!open) {
      setResetTarget(null);
    }
  }, []);

  const handleResetSubmit = useCallback(
    async ({ newPassword, confirmPassword }: { newPassword: string; confirmPassword: string }) => {
      if (!resetTarget) return;
      const trimmedPassword = newPassword.trim();
      if (!trimmedPassword) {
        toast.error('请输入新密码');
        return;
      }
      if (trimmedPassword.length < 8) {
        toast.error('新密码至少需要 8 个字符');
        return;
      }
      if (confirmPassword && confirmPassword !== trimmedPassword) {
        toast.error('两次输入的新密码不一致');
        return;
      }

      setResetSaving(true);
      try {
        const response = await fetch(`/api/employees/${resetTarget.id}/password`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newPassword: trimmedPassword, confirmPassword }),
        });
        const payload: EmployeeMutationResponse = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || '重置失败');
        }
        toast.success('密码已重置');
        setResetDialogOpen(false);
        setResetTarget(null);
      } catch (error) {
        console.error('重置密码失败', error);
        toast.error(error instanceof Error ? error.message : '重置失败');
      } finally {
        setResetSaving(false);
      }
    },
    [resetTarget]
  );

  const handleRoleSubmit = useCallback(
    async ({ roles, primaryRole }: RoleAssignmentPayload) => {
      if (!roleTarget) return;
      if (!canAssignRoles) {
        toast.error('当前账户无权设置角色');
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
        toast.error(error instanceof Error ? error.message : '设置角色失败');
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

    // Handle quick create action from URL
    if (searchParams.get('action') === 'new' && canCreateEmployee) {
      setSelectedEmployee(null);
      setIsEditMode(false);
      setIsFormOpen(true);
      // Clean up URL
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('action');
      router.replace(`${pathname}?${newParams.toString()}`);
    }

    if (hasFetchedInitial.current) {
      return;
    }
    hasFetchedInitial.current = true;
    refreshList(initialPage, initialPageSize, DEFAULT_FILTERS).catch((err) => {
      console.error('初始化员工列表失败', err);
      hasFetchedInitial.current = false;
    });
  }, [permissionLoading, canViewEmployees, initialPage, initialPageSize, refreshList, searchParams, canCreateEmployee, pathname, router]);

  const activeCount = useMemo(() => employees.filter((emp) => emp.employmentStatus === 'active').length, [employees]);
  const onLeaveCount = useMemo(() => employees.filter((emp) => emp.employmentStatus === 'on_leave').length, [employees]);
  const terminatedCount = useMemo(() => employees.filter((emp) => emp.employmentStatus === 'terminated').length, [employees]);

  const activeFilterChips = useMemo(() => {
    const chips: Array<{ key: string; label: string; onRemove: () => void }> = [];
    const trimmedSearch = filters.search.trim();
    if (trimmedSearch) {
      chips.push({
        key: 'search',
        label: `关键词：${trimmedSearch}`,
        onRemove: () => {
          setSearchInput('');
          lastSearchTermRef.current = '';
          handleSearch({ search: '' });
        },
      });
    }
    if (filters.status !== 'all') {
      chips.push({
        key: 'status',
        label: `状态：${EMPLOYMENT_STATUS_LABELS[filters.status] ?? filters.status}`,
        onRemove: () => handleSearch({ status: 'all' }),
      });
    }
    if (filters.sortBy !== DEFAULT_FILTERS.sortBy) {
      const sortLabelMap: Record<EmployeeFilters['sortBy'], string> = {
        updatedAt: '按更新时间',
        createdAt: '按创建时间',
        displayName: '按姓名',
        status: '按状态',
      };
      chips.push({
        key: 'sortBy',
        label: `排序：${sortLabelMap[filters.sortBy] ?? filters.sortBy}`,
        onRemove: () => handleSearch({ sortBy: DEFAULT_FILTERS.sortBy, sortOrder: DEFAULT_FILTERS.sortOrder }),
      });
    }
    return chips;
  }, [filters, handleSearch]);

  const activeFilterCount = activeFilterChips.length;

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
      <div className="panel-frame p-6 text-sm text-muted-foreground">
        正在加载权限信息...
      </div>
    );
  }

  if (!canViewEmployees) {
    return (
      <div className="alert-box alert-warning p-6 text-sm">
        当前账户无权访问员工模块，请联系管理员或系统管理员开通 USER_VIEW_ALL 权限。
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Stats Chips */}
      <div className="flex flex-wrap gap-2">
        {renderSummaryChip('active', activeCount)}
        {renderSummaryChip('on_leave', onLeaveCount)}
        {renderSummaryChip('terminated', terminatedCount)}
      </div>

      {/* Filters & Actions Bar */}
      <div className="surface-toolbar p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
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
                placeholder="搜索姓名/邮箱/电话"
                className="h-10 w-full pl-10 text-sm"
              />
            </div>
            <Button variant="secondary" size="sm" onClick={triggerImmediateSearch} className="h-10 px-4">
              查询
            </Button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Drawer open={filterDrawerOpen} onOpenChange={setFilterDrawerOpen} direction="right">
              <DrawerTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 px-4">
                  筛选
                  {activeFilterCount > 0 && (
                    <Badge className="ml-1 rounded-full px-2 py-0 text-[10px]" variant="secondary">
                      {activeFilterCount}
                    </Badge>
                  )}
                </Button>
              </DrawerTrigger>
              <DrawerContent side="right" className="sm:max-w-xl">
                <DrawerHeader>
                  <DrawerTitle>筛选条件</DrawerTitle>
                  <DrawerDescription>组合多个条件以快速定位员工。</DrawerDescription>
                </DrawerHeader>
                <DrawerBody className="space-y-4">
                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">状态</span>
                    <Select value={filters.status} onValueChange={(value) => handleSearch({ status: value as EmployeeFilters['status'] })}>
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="全部状态" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">全部状态</SelectItem>
                        <SelectItem value="active">在职</SelectItem>
                        <SelectItem value="on_leave">休假</SelectItem>
                        <SelectItem value="terminated">已离职</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <span className="text-xs font-medium text-muted-foreground">排序</span>
                    <Select
                      value={filters.sortBy}
                      onValueChange={(value) => handleSearch({ sortBy: value as EmployeeFilters['sortBy'] })}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="排序字段" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="updatedAt">按更新时间</SelectItem>
                        <SelectItem value="createdAt">按创建时间</SelectItem>
                        <SelectItem value="displayName">按姓名</SelectItem>
                        <SelectItem value="status">按状态</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </DrawerBody>
                <DrawerFooter>
                  <Button type="button" variant="outline" onClick={handleResetFilters}>
                    重置
                  </Button>
                  <Button type="button" onClick={() => setFilterDrawerOpen(false)}>
                    完成
                  </Button>
                </DrawerFooter>
              </DrawerContent>
            </Drawer>

            <Button variant="ghost" size="sm" onClick={handleResetFilters} className="h-10 px-3 text-muted-foreground">
              清空
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refreshList()}
              disabled={loading || isPending}
              className="h-10 gap-1"
            >
              <RefreshCcw className="h-4 w-4" /> 刷新
            </Button>
            {canViewEmployees && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="outline" size="sm" className="h-10 gap-1" disabled={exporting}>
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
              <Button type="button" size="sm" onClick={handleCreateClick} className="h-10 gap-1">
                <Plus className="h-4 w-4" /> 新增
              </Button>
            )}
          </div>
        </div>

        {activeFilterChips.length > 0 && (
          <div className="mt-3 flex flex-nowrap gap-2 overflow-x-auto pb-1 text-xs sm:flex-wrap">
            {activeFilterChips.map((chip) => (
              <Button
                key={chip.key}
                type="button"
                variant="outline"
                size="sm"
                className="h-8 shrink-0 rounded-full px-3 text-xs"
                onClick={chip.onRemove}
              >
                {chip.label} ×
              </Button>
            ))}
          </div>
        )}
      </div>

      <EmployeeTable
        employees={employees}
        loading={loading || isPending}
        onEdit={handleEdit}
        onDelete={handleDelete}
        onResetPassword={handleResetPasswordClick}
        canEdit={canUpdateEmployee}
        canDelete={canDeleteEmployee}
        onAssignRoles={canAssignRoles ? handleRoleAssignClick : undefined}
        canAssignRoles={canAssignRoles}
        canResetPassword={canUpdateEmployee}
      />

      {/* Pagination */}
      <div className="surface-card flex flex-col gap-3 px-4 py-3 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div>共 {total} 人 · 第 {page} / {totalPages} 页</div>
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
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
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

      <ResetPasswordDialog
        open={resetDialogOpen}
        employee={resetTarget}
        saving={resetSaving}
        onOpenChange={handleResetDialogChange}
        onSubmit={handleResetSubmit}
      />

      <CredentialsDialog
        open={credentialsOpen}
        accounts={credentialsAccounts}
        password={credentialsPassword}
        onOpenChange={setCredentialsOpen}
      />

      <Drawer open={isFormOpen} onOpenChange={handleDialogOpenChange} direction="right">
        <DrawerContent side="right" className={FORM_DRAWER_WIDTH_WIDE}>
          <DrawerHeader>
            <div className="flex items-start justify-between gap-4">
              <div>
                <DrawerTitle>
                  {isEditMode
                    ? `编辑员工: ${selectedEmployee?.displayName ?? selectedEmployee?.email ?? ''}`
                    : selectedEmployee
                      ? '员工详情'
                      : '新增员工'}
                </DrawerTitle>
                <DrawerDescription>
                  {isEditMode
                    ? '更新员工档案信息，保存后立即生效'
                    : selectedEmployee
                      ? '查看员工基础信息，如需调整请切换到编辑模式'
                      : '填写入职信息后提交创建新的员工记录'}
                </DrawerDescription>
              </div>
              <div className="flex gap-2">
                {selectedEmployee && !isEditMode && (
                  <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)}>
                    编辑
                  </Button>
                )}
                <DrawerClose asChild>
                  <Button variant="ghost" size="sm" onClick={handleDialogClose}>
                    关闭
                  </Button>
                </DrawerClose>
              </div>
            </div>
          </DrawerHeader>
          <DrawerBody>
            {isFormOpen && (
              <div className="space-y-6">
                <EmployeeForm
                  initialData={selectedEmployee}
                  canAssignRoles={canAssignRoles}
                  onSubmit={isEditMode ? handleUpdate : handleCreate}
                  onCancel={() => {
                    setIsFormOpen(false);
                    setIsEditMode(false);
                    setSelectedEmployee(null);
                  }}
                  formId="employee-details-form"
                  hideActions
                />
                {selectedEmployee && (
                  <EmployeeStatusHistory
                    employeeId={selectedEmployee.id}
                    refreshSignal={statusHistoryRefreshSignal}
                  />
                )}
              </div>
            )}
          </DrawerBody>
          <DrawerFooter className="px-4 py-3 border-t">
            <DrawerClose asChild>
              <Button type="button" variant="outline" onClick={handleDialogClose}>
                取消
              </Button>
            </DrawerClose>
            {(!selectedEmployee || isEditMode) && (
              <Button type="submit" form="employee-details-form">
                {selectedEmployee ? '保存修改' : '确认新增'}
              </Button>
            )}
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      <Drawer open={importDialogOpen} onOpenChange={handleImportDialogChange} direction="right">
        <DrawerContent side="right" className={FORM_DRAWER_WIDTH_STANDARD}>
          <DrawerHeader>
            <DrawerTitle>批量导入员工</DrawerTitle>
            <DrawerDescription>
              支持粘贴 JSON 数组或上传 CSV 文件，字段与单条新增员工一致。
            </DrawerDescription>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            <div className="space-y-3 rounded-lg border border-dashed border-border/70 bg-muted/10 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="space-y-1 text-xs text-muted-foreground">
                <p className="text-sm font-medium text-foreground">上传 CSV 文件</p>
                <p>首行必须包含字段名，系统会匹配常见列名并自动转换状态、日期等字段。</p>
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
              <div className="alert-box alert-danger rounded-md px-3 py-2 text-xs">
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
          <div className="grid grid-cols-1 gap-3 rounded-lg border border-border/60 bg-background/60 p-4 text-sm md:grid-cols-2">
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">导入默认初始密码（可选）</span>
              <Input
                type="text"
                placeholder="为空则使用每行 initialPassword"
                value={importDefaultPassword}
                onChange={(event) => setImportDefaultPassword(event.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={importUseCodePassword}
                onCheckedChange={(value) => setImportUseCodePassword(value === true)}
              />
              使用员工编号作为初始密码（优先于默认密码）
            </label>
          </div>
          <Textarea
            value={importText}
            onChange={(event) => setImportText(event.target.value)}
            placeholder={IMPORT_TEMPLATE}
            rows={12}
            className="font-mono text-xs"
          />
          {importError && (
            <div className="alert-box alert-danger rounded-md px-3 py-2 text-xs">
              {importError}
            </div>
          )}
            {importResult && (
              <div className="rounded-md border border-chart-5/40 bg-chart-5/10 px-3 py-2 text-xs text-chart-5">
                <p>
                  新增 {importResult.created} 条，更新 {importResult.updated} 条，跳过 {importResult.skipped} 条。
                </p>
                {importResult.errors?.length ? (
                  <div className="mt-2 space-y-1 text-[11px] text-chart-5/90">
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
          </DrawerBody>
          <DrawerFooter>
            <DrawerClose asChild>
              <Button type="button" variant="ghost" onClick={() => handleImportDialogChange(false)}>
                取消
              </Button>
            </DrawerClose>
            <Button type="button" onClick={handleImportSubmit} disabled={importing} className="gap-1">
              {importing ? <RefreshCcw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {importing ? '导入中...' : '开始导入'}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {error && (
        <div className="alert-box alert-danger px-4 py-3 text-sm">
          {error}
        </div>
      )}
    </div>
  );
}
