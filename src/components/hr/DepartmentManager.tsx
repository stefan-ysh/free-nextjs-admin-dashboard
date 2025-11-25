'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pencil, Plus, RefreshCcw, Trash2 } from 'lucide-react';

import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { formatDateTimeLocal } from '@/lib/dates';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { useConfirm } from '@/hooks/useConfirm';
import ModalShell from '@/components/common/ModalShell';

const EMPTY_FORM = {
  name: '',
  code: '',
  parentId: 'none',
  sortOrder: '0',
  description: '',
};

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

export default function DepartmentManager() {
  const { hasPermission, loading: permissionLoading } = usePermissions();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formValues, setFormValues] = useState(() => ({ ...EMPTY_FORM }));
  const [editing, setEditing] = useState<Department | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const confirm = useConfirm();

  const canView = hasPermission('USER_VIEW_ALL');
  const canCreate = hasPermission('USER_CREATE');
  const canUpdate = hasPermission('USER_UPDATE');
  const canDelete = hasPermission('USER_DELETE');

  const parentNameMap = useMemo(() => {
    const map = new Map<string, string>();
    departments.forEach((dept) => map.set(dept.id, dept.name));
    return map;
  }, [departments]);

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
    setEditing(dept);
    setFormValues({
      name: dept.name,
      code: dept.code ?? '',
      parentId: dept.parentId ?? 'none',
      sortOrder: String(dept.sortOrder ?? 0),
      description: dept.description ?? '',
    });
    setDialogOpen(true);
  }, []);

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
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>名称</TableHead>
              <TableHead>编码</TableHead>
              <TableHead>父级</TableHead>
              <TableHead className="text-right">排序</TableHead>
              <TableHead>更新时间</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {departments.map((dept) => (
              <TableRow key={dept.id}>
                <TableCell>
                  <div className="font-medium">{dept.name}</div>
                  {dept.description ? (
                    <p className="text-xs text-muted-foreground">{dept.description}</p>
                  ) : null}
                </TableCell>
                <TableCell>{dept.code ?? '—'}</TableCell>
                <TableCell>{dept.parentId ? parentNameMap.get(dept.parentId) ?? '—' : '—'}</TableCell>
                <TableCell className="text-right">{dept.sortOrder ?? 0}</TableCell>
                <TableCell>{formatDateTimeLocal(dept.updatedAt) ?? dept.updatedAt}</TableCell>
                <TableCell className="text-right">
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
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">部门管理</h1>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchDepartments} disabled={loading || !canView}>
            <RefreshCcw className="mr-2 h-4 w-4" />刷新
          </Button>
          {(canCreate || canUpdate) && (
            <Button onClick={handleCreateClick} disabled={!canCreate}>
              <Plus className="mr-2 h-4 w-4" />新建部门
            </Button>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b px-6 py-4">
          <p className="text-sm font-medium">部门列表</p>
          <p className="text-xs text-muted-foreground">当前共有 {departments.length} 个部门</p>
        </div>
        <div className="px-6 py-6">{renderContent()}</div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
        <DialogContent className="max-w-xl overflow-hidden p-0">
          <form onSubmit={handleSubmit}>
            <ModalShell
              title={editing ? '编辑部门' : '新建部门'}
              description="设置部门的基础信息与层级关系，供员工档案引用"
              footer={
                <DialogFooter className="gap-3">
                  <Button type="button" variant="outline" onClick={closeDialog} disabled={submitting}>
                    取消
                  </Button>
                  <Button type="submit" disabled={submitting || formValues.name.trim() === ''}>
                    {submitting ? '提交中...' : editing ? '保存修改' : '创建部门'}
                  </Button>
                </DialogFooter>
              }
            >
              <div className="space-y-4">
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
              </div>
            </ModalShell>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
