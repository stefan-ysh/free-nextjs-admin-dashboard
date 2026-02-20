'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCcw, Trash2 } from 'lucide-react';

import { usePermissions } from '@/hooks/usePermissions';
import Pagination from '@/components/tables/Pagination';
import { Button } from '@/components/ui/button';
import { formatDateTimeLocal } from '@/lib/dates';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  Drawer,
  DrawerBody,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { useConfirm } from '@/hooks/useConfirm';
import { FORM_DRAWER_WIDTH_COMPACT } from '@/components/common/form-drawer-width';

const EMPTY_FORM = {
  name: '',
  code: '',
  parentId: 'none',
  sortOrder: '0',
  description: '',
  annualBudget: '',
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

type Department = {
  id: string;
  name: string;
  code: string | null;
  parentId: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

type BudgetSummary = {
  departmentId: string;
  year: number;
  budgetAmount: number | null;
  usedAmount: number;
  remainingAmount: number | null;
};

export default function DepartmentManager() {
  const { hasPermission, loading: permissionLoading } = usePermissions();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [budgetMap, setBudgetMap] = useState<Record<string, BudgetSummary>>({});
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formValues, setFormValues] = useState(() => ({ ...EMPTY_FORM }));
  const [editing, setEditing] = useState<Department | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const confirm = useConfirm();
  const departmentFormId = 'department-form';

  const canView = hasPermission('USER_VIEW_ALL');
  const canCreate = hasPermission('USER_CREATE');
  const canUpdate = hasPermission('USER_UPDATE');
  const canDelete = hasPermission('USER_DELETE');

  const parentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((dept) => map.set(dept.id, dept.name));
    return map;
  }, [departments]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(departments.length / pageSize)), [departments.length, pageSize]);

  const paginatedDepartments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return departments.slice(start, start + pageSize);
  }, [departments, page, pageSize]);

  useEffect(() => {
    setPage((prev) => {
      if (prev > totalPages) {
        return totalPages;
      }
      return prev;
    });
  }, [totalPages]);

  const resetForm = useCallback(() => {
    setFormValues({ ...EMPTY_FORM });
    setEditing(null);
  }, []);

  const closeDialog = useCallback(() => {
    setDialogOpen(false);
    setSubmitting(false);
    setTimeout(() => {
      resetForm();
    }, 200);
  }, [resetForm]);

  const fetchDepartments = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/hr/departments');
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || '加载失败');
      }
      setDepartments(payload.data || []);
      try {
        const year = new Date().getFullYear();
        const budgetResponse = await fetch(`/api/hr/departments/budgets?year=${year}`);
        const budgetPayload = await budgetResponse.json();
        if (budgetResponse.ok && budgetPayload.success && Array.isArray(budgetPayload.data)) {
          const map: Record<string, BudgetSummary> = {};
          budgetPayload.data.forEach((entry: BudgetSummary) => {
            map[entry.departmentId] = entry;
          });
          setBudgetMap(map);
        }
      } catch (budgetError) {
        console.warn('加载部门预算失败', budgetError);
        setBudgetMap({});
      }
    } catch (err) {
      console.error('加载部门列表失败', err);
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    if (!canView) return;
    fetchDepartments();
  }, [canView, fetchDepartments]);

  const handleCreateClick = useCallback(() => {
    setEditing(null);
    setFormValues({ ...EMPTY_FORM });
    setDialogOpen(true);
  }, []);

  const handleEditClick = useCallback((dept: Department) => {
    const budget = budgetMap[dept.id];
    setEditing(dept);
    setFormValues({
      name: dept.name,
      code: dept.code ?? '',
      parentId: dept.parentId ?? 'none',
      sortOrder: String(dept.sortOrder ?? 0),
      description: dept.description ?? '',
      annualBudget: budget?.budgetAmount != null ? String(budget.budgetAmount) : '',
    });
    setDialogOpen(true);
  }, [budgetMap]);

  const handleDelete = useCallback(
    async (dept: Department) => {
      if (!canDelete) {
        toast.error('无权限', { description: '当前账户无权删除部门' });
        return;
      }
      const confirmed = await confirm({
        title: `确定删除部门「${dept.name}」？`,
        description: "此操作无法撤销。",
        confirmText: "删除",
        cancelText: "取消",
      });
      if (!confirmed) return;

      try {
        const response = await fetch(`/api/hr/departments/${dept.id}`, { method: 'DELETE' });
        const payload = await response.json();
        if (!response.ok || !payload.success) {
          throw new Error(payload.error || '删除失败');
        }
        toast.success('删除成功', { description: `已删除部门「${dept.name}」` });
        fetchDepartments();
      } catch (err) {
        console.error('删除部门失败', err);
        toast.error('删除失败', {
          description: err instanceof Error ? err.message : '服务器错误',
        });
      }
    },
    [canDelete, fetchDepartments, confirm]
  );

  const handleDialogOpenChange = useCallback(
    (open: boolean) => {
      if (!open) {
        closeDialog();
      } else {
        setDialogOpen(true);
      }
    },
    [closeDialog]
  );

  const handleFieldChange = useCallback((field: keyof typeof EMPTY_FORM, value: string) => {
    setFormValues((prev) => ({ ...prev, [field]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const allowSubmit = editing ? canUpdate : canCreate;
      if (!allowSubmit) {
        toast.error('无权限', { description: '当前账户无权执行此操作' });
        return;
      }
      setSubmitting(true);
      try {
        const payload = {
          name: formValues.name,
          code: formValues.code?.trim() || null,
          parentId: formValues.parentId === 'none' ? null : formValues.parentId,
          sortOrder: Number.parseInt(formValues.sortOrder, 10),
          description: formValues.description?.trim() || null,
        };
        const target = editing ? `/api/hr/departments/${editing.id}` : '/api/hr/departments';
        const method = editing ? 'PATCH' : 'POST';
        const response = await fetch(target, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || '保存失败');
        }
        const savedDepartmentId = data.data?.id ?? editing?.id;
        const budgetValue = Number(formValues.annualBudget);
        if (savedDepartmentId && formValues.annualBudget !== '' && Number.isFinite(budgetValue)) {
          const year = new Date().getFullYear();
          await fetch(`/api/hr/departments/${savedDepartmentId}/budget`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ year, amount: budgetValue }),
          });
        }
        toast.success(editing ? '更新成功' : '创建成功', {
          description: editing ? '部门信息已更新' : '已创建新部门',
        });
        closeDialog();
        fetchDepartments();
      } catch (err) {
        console.error('保存部门失败', err);
        toast.error('保存失败', {
          description: err instanceof Error ? err.message : '服务器错误',
        });
      } finally {
        setSubmitting(false);
      }
    },
    [editing, canUpdate, canCreate, formValues, closeDialog, fetchDepartments]
  );

  const parentCandidates = useMemo(() => {
    return departments.filter((dept) => !editing || dept.id !== editing.id);
  }, [departments, editing]);

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const renderContent = () => {
    if (permissionLoading) {
      return <div className="py-10 text-center text-sm text-muted-foreground">权限加载中...</div>;
    }
    if (!canView) {
      return <div className="py-10 text-center text-sm text-muted-foreground">当前账户无权查看部门数据</div>;
    }
    if (loading) {
      return <div className="py-10 text-center text-sm text-muted-foreground">部门列表加载中...</div>;
    }
    if (error) {
      return (
        <div className="py-10 text-center text-sm text-red-500">
          加载失败：{error}
          <div className="mt-3">
            <Button variant="outline" size="sm" onClick={fetchDepartments}>
              重试
            </Button>
          </div>
        </div>
      );
    }
    if (departments.length === 0) {
      return <div className="py-10 text-center text-sm text-muted-foreground">暂无部门，点击「新建部门」开始配置</div>;
    }
    return (
      <div className="flex flex-1 min-h-0 flex-col gap-4">
        <div className="surface-table flex-1 min-h-0">
          <Table
            stickyHeader
            scrollAreaClassName="max-h-[calc(100vh-280px)] custom-scrollbar"
            className="text-sm text-muted-foreground"
          >
            <TableHeader>
              <TableRow className="bg-muted/60 text-xs uppercase tracking-wide">
                <TableHead className="px-4 py-3">名称</TableHead>
                <TableHead className="px-4 py-3">编码</TableHead>
                <TableHead className="px-4 py-3">父级</TableHead>
                <TableHead className="px-4 py-3">年度预算</TableHead>
                <TableHead className="px-4 py-3 text-right">排序</TableHead>
                <TableHead className="px-4 py-3">更新时间</TableHead>
                <TableHead className="px-4 py-3 text-right">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedDepartments.map((dept) => (
                <TableRow key={dept.id} className="border-b border-border/40 hover:bg-muted/40 last:border-0">
                  <TableCell className="px-4 py-4 whitespace-normal">
                    <div className="font-medium text-foreground">{dept.name}</div>
                    {dept.description ? <p className="text-xs text-muted-foreground">{dept.description}</p> : null}
                  </TableCell>
                  <TableCell className="px-4 py-4">{dept.code ?? '—'}</TableCell>
                  <TableCell className="px-4 py-4">{dept.parentId ? parentNameMap.get(dept.parentId) ?? '—' : '—'}</TableCell>
                  <TableCell className="px-4 py-4 text-sm">
                    {budgetMap[dept.id]?.budgetAmount != null ? (
                      <div className="space-y-1">
                        <div className="font-medium text-foreground">
                          ¥{Number(budgetMap[dept.id].budgetAmount).toLocaleString('zh-CN')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          已用 ¥{Number(budgetMap[dept.id].usedAmount).toLocaleString('zh-CN')} /
                          余 ¥{Number(budgetMap[dept.id].remainingAmount ?? 0).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">未设置</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right">{dept.sortOrder ?? 0}</TableCell>
                  <TableCell className="px-4 py-4 text-sm text-muted-foreground">
                    {formatDateTimeLocal(dept.updatedAt) ?? dept.updatedAt}
                  </TableCell>
                  <TableCell className="px-4 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      {canUpdate && (
                        <Button variant="ghost" size="icon" onClick={() => handleEditClick(dept)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button variant="ghost" size="icon" onClick={() => handleDelete(dept)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        <div className="flex flex-col gap-3 border-t border-transparent px-2 py-2 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
          <div>共 {departments.length} 个部门 • 第 {page} / {totalPages} 页</div>
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
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      <div className="surface-card flex justify-end p-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDepartments} disabled={loading || !canView} className="h-9">
            <RefreshCcw className="mr-2 h-4 w-4" />刷新
          </Button>
          {(canCreate || canUpdate) && (
            <Button onClick={handleCreateClick} disabled={!canCreate} size="sm" className="h-9">
              <Plus className="mr-2 h-4 w-4" />新建部门
            </Button>
          )}
        </div>
      </div>

      {renderContent()}

      <Drawer open={dialogOpen} onOpenChange={handleDialogOpenChange} direction="right">
        <DrawerContent side="right" className={FORM_DRAWER_WIDTH_COMPACT}>
          <DrawerHeader className="flex items-start justify-between gap-4">
            <div>
              <DrawerTitle>{editing ? '编辑部门' : '新建部门'}</DrawerTitle>
              <DrawerDescription>设置部门的基础信息与层级关系，供员工档案引用</DrawerDescription>
            </div>
            <DrawerClose asChild>
              <Button variant="ghost" size="sm" onClick={closeDialog}>
                关闭
              </Button>
            </DrawerClose>
          </DrawerHeader>
          <DrawerBody>
            <form id={departmentFormId} onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="department-name">部门名称 *</Label>
                <Input
                  id="department-name"
                  placeholder="例如：人力资源部"
                  value={formValues.name}
                  onChange={(event) => handleFieldChange('name', event.target.value)}
                  required
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="department-code">编码</Label>
                  <Input
                    id="department-code"
                    placeholder="如 HR"
                    value={formValues.code}
                    onChange={(event) => handleFieldChange('code', event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="department-sort">排序</Label>
                  <Input
                    id="department-sort"
                    type="number"
                    value={formValues.sortOrder}
                    onChange={(event) => handleFieldChange('sortOrder', event.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department-budget">年度预算 (¥)</Label>
                <Input
                  id="department-budget"
                  type="number"
                  min={0}
                  step="0.01"
                  placeholder="例如：500000"
                  value={formValues.annualBudget}
                  onChange={(event) => handleFieldChange('annualBudget', event.target.value)}
                />
                <p className="text-xs text-muted-foreground">设置当前年度部门预算，用于采购实时校验。</p>
              </div>
              <div className="space-y-2">
                <Label>父级部门</Label>
                <Select value={formValues.parentId} onValueChange={(value) => handleFieldChange('parentId', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="请选择父级部门" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">顶级（无父级）</SelectItem>
                    {parentCandidates.map((dept) => (
                      <SelectItem key={dept.id} value={dept.id}>
                        {dept.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="department-description">备注</Label>
                <Textarea
                  id="department-description"
                  placeholder="可选：补充职责、说明"
                  value={formValues.description}
                  onChange={(event) => handleFieldChange('description', event.target.value)}
                  rows={4}
                />
              </div>
            </form>
          </DrawerBody>
          <DrawerFooter className="justify-end">
            <DrawerClose asChild>
              <Button type="button" variant="outline" onClick={closeDialog} disabled={submitting}>
                取消
              </Button>
            </DrawerClose>
            <Button type="submit" form={departmentFormId} disabled={submitting || formValues.name.trim() === ''}>
              {submitting ? '提交中...' : editing ? '保存修改' : '创建部门'}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </div>
  );
}
