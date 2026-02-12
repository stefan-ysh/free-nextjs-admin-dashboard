"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Edit2, Loader2, PlusCircle, Trash2 } from 'lucide-react';

import { usePermissions } from '@/hooks/usePermissions';
import type {
  Supplier,
  SupplierBankAccountInput,
  SupplierContactInput,
  SupplierPayload,
  SupplierStatus,
} from '@/types/supplier';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import ModalShell from '@/components/common/ModalShell';
import { cn } from '@/lib/utils';

const PAGE_SIZE_OPTIONS = [10, 20, 50];

const statusLabels: Record<SupplierStatus, string> = {
  active: '正常合作',
  inactive: '暂停',
  blacklisted: '黑名单',
};

const statusBadgeClass: Record<SupplierStatus, string> = {
  active: 'bg-chart-5/15 text-chart-5',
  inactive: 'bg-chart-3/20 text-chart-3',
  blacklisted: 'bg-destructive/15 text-destructive',
};

const paymentTerms = ['cash', 't+7', 't+15', 't+30', 't+60', 'custom'] as const;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
const defaultFriendlyMessage = '系统暂时无法加载数据，请稍后再试';
const SUMMARY_CHIP_CLASS = 'flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm';

function getFriendlyErrorMessage(error: unknown): string {
  if (!(error instanceof Error) || !error.message) {
    return defaultFriendlyMessage;
  }
  const message = error.message.toLowerCase();
  if (message.includes('network')) return '网络异常，请检查连接后重试';
  if (message.includes('timeout')) return '请求超时，请稍后再试';
  if (message.includes('permission') || message.includes('unauthorized') || message.includes('forbidden')) {
    return '暂无权限执行此操作，如需帮助请联系管理员';
  }
  return defaultFriendlyMessage;
}

const createEmptyContact = (isPrimary = false): SupplierContactInput => ({
  name: '',
  role: '',
  mobile: '',
  email: '',
  note: '',
  isPrimary,
});

const createEmptyBank = (isPrimary = false): SupplierBankAccountInput => ({
  bankName: '',
  accountName: '',
  accountNumber: '',
  branch: '',
  country: '',
  currency: 'CNY',
  swiftCode: '',
  note: '',
  isPrimary,
});

const createDefaultForm = (): SupplierPayload & { contacts: SupplierContactInput[]; bankAccounts: SupplierBankAccountInput[] } => ({
  name: '',
  shortName: '',
  category: '',
  rating: 3,
  taxNumber: '',
  invoiceTitle: '',
  registeredAddress: '',
  officeAddress: '',
  website: '',
  phone: '',
  mobile: '',
  email: '',
  paymentTerm: 't+30',
  creditLimit: 0,
  tags: [],
  status: 'active',
  notes: '',
  contacts: [createEmptyContact(true)],
  bankAccounts: [createEmptyBank(true)],
});

function ensureContacts(list?: SupplierContactInput[]): SupplierContactInput[] {
  if (!list?.length) return [createEmptyContact(true)];
  const hasPrimary = list.some((contact) => contact.isPrimary);
  return list.map((contact, index) => ({
    ...contact,
    isPrimary: hasPrimary ? Boolean(contact.isPrimary) : index === 0,
  }));
}

function ensureBankAccounts(list?: SupplierBankAccountInput[]): SupplierBankAccountInput[] {
  if (!list?.length) return [createEmptyBank(true)];
  const hasPrimary = list.some((account) => account.isPrimary);
  return list.map((account, index) => ({
    ...account,
    isPrimary: hasPrimary ? Boolean(account.isPrimary) : index === 0,
  }));
}

function validateSupplierForm(
  form: SupplierPayload & { contacts: SupplierContactInput[]; bankAccounts: SupplierBankAccountInput[] }
): string | null {
  if (!form.name.trim()) {
    return '请填写供应商名称';
  }

  if (!form.paymentTerm?.trim()) {
    return '请选择付款条件';
  }

  if ((form.creditLimit ?? 0) < 0) {
    return '授信额度不能为负数';
  }

  const contacts = ensureContacts(form.contacts);
  if (!contacts.length || !contacts.some((contact) => contact.name.trim())) {
    return '请至少填写一位联系人姓名';
  }

  const invalidEmail = contacts.find((contact) => contact.email && !emailPattern.test(contact.email));
  if (invalidEmail) {
    return `联系人 ${invalidEmail.name || ''} 的邮箱格式不正确`;
  }

  const banks = ensureBankAccounts(form.bankAccounts);
  if (!banks.length) {
    return '请至少添加一个银行账户';
  }

  const invalidBank = banks.find(
    (account) => !account.bankName?.trim() || !account.accountName?.trim() || !account.accountNumber?.trim()
  );
  if (invalidBank) {
    return '银行账户需填写完整（开户行 / 户名 / 账号）';
  }

  return null;
}

export default function SupplierManagementPage() {
  const { hasPermission, loading: permissionLoading } = usePermissions();
  const canView = hasPermission('SUPPLIER_VIEW');
  const canManage = hasPermission('SUPPLIER_MANAGE');

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [form, setForm] = useState(createDefaultForm);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | SupplierStatus>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Supplier | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const stats = useMemo(() => {
    const active = suppliers.filter((supplier) => supplier.status === 'active').length;
    const blacklisted = suppliers.filter((supplier) => supplier.status === 'blacklisted').length;
    const totalCredit = suppliers.reduce((sum, supplier) => sum + Number(supplier.creditLimit || 0), 0);
    return { active, blacklisted, totalCredit };
  }, [suppliers]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(total / pageSize)), [total, pageSize]);

  useEffect(() => {
    setPage((prev) => {
      if (prev > totalPages) {
        return totalPages;
      }
      return prev;
    });
  }, [totalPages]);

  const supplierDialogDescription = editingSupplier ? '更新供应商档案，保存后立即生效。' : '完善供应商档案，提交后即可在采购流程中引用。';

  const formattedCredit = useMemo(
    () => `¥${Number(stats.totalCredit || 0).toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`,
    [stats.totalCredit]
  );

  const loadSuppliers = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('pageSize', String(pageSize));
      if (search.trim()) params.set('search', search.trim());
      if (filterStatus !== 'all') params.set('status', filterStatus);
      const response = await fetch(`/api/suppliers?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? '加载供应商失败');
      }
      setSuppliers(payload.data.items ?? []);
      setTotal(payload.data.total ?? 0);
    } catch (error) {
      console.error('加载供应商失败', error);
      toast.error('加载供应商失败', { description: getFriendlyErrorMessage(error) });
      setSuppliers([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [canView, filterStatus, search, page, pageSize]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers, refreshKey]);

  const handleOpenDialog = () => {
    setEditingSupplier(null);
    setForm(createDefaultForm());
    setDialogLoading(false);
    setDialogOpen(true);
  };

  const handleEditDialog = async (supplier: Supplier) => {
    setDialogOpen(true);
    setDialogLoading(true);
    setEditingSupplier(supplier);
    try {
      const response = await fetch(`/api/suppliers/${supplier.id}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? '加载供应商详情失败');
      }
      const detail = payload.data as Supplier;
      setEditingSupplier(detail);
      setForm({
        name: detail.name,
        shortName: detail.shortName ?? '',
        category: detail.category ?? '',
        rating: detail.rating ?? 3,
        taxNumber: detail.taxNumber ?? '',
        invoiceTitle: detail.invoiceTitle ?? '',
        registeredAddress: detail.registeredAddress ?? '',
        officeAddress: detail.officeAddress ?? '',
        website: detail.website ?? '',
        phone: detail.phone ?? '',
        mobile: detail.mobile ?? '',
        email: detail.email ?? '',
        paymentTerm: detail.paymentTerm ?? 'cash',
        creditLimit: detail.creditLimit ?? 0,
        tags: detail.tags ?? [],
        status: detail.status,
        notes: detail.notes ?? '',
        contacts: ensureContacts(detail.contacts?.map((contact) => ({
          name: contact.name,
          role: contact.role ?? '',
          mobile: contact.mobile ?? '',
          email: contact.email ?? '',
          note: contact.note ?? '',
          isPrimary: contact.isPrimary,
        })) ?? [createEmptyContact(true)]),
        bankAccounts: ensureBankAccounts(detail.bankAccounts?.map((account) => ({
          bankName: account.bankName,
          accountName: account.accountName,
          accountNumber: account.accountNumber,
          branch: account.branch ?? '',
          country: account.country ?? '',
          currency: account.currency ?? 'CNY',
          swiftCode: account.swiftCode ?? '',
          note: account.note ?? '',
          isPrimary: account.isPrimary,
        })) ?? [createEmptyBank(true)]),
      });
    } catch (error) {
      console.error('加载供应商详情失败', error);
      toast.error('加载失败', { description: error instanceof Error ? error.message : '请稍后再试' });
      setDialogOpen(false);
      setEditingSupplier(null);
    } finally {
      setDialogLoading(false);
    }
  };

  const handleContactFieldChange = (index: number, key: keyof SupplierContactInput, value: string | boolean) => {
    setForm((prev) => {
      const contacts = ensureContacts(prev.contacts);
      contacts[index] = { ...contacts[index], [key]: value } as SupplierContactInput;
      return { ...prev, contacts };
    });
  };

  const handleSetPrimaryContact = (index: number) => {
    setForm((prev) => {
      const contacts = ensureContacts(prev.contacts).map((contact, idx) => ({
        ...contact,
        isPrimary: idx === index,
      }));
      return { ...prev, contacts };
    });
  };

  const handleAddContact = () => {
    setForm((prev) => ({
      ...prev,
      contacts: [...ensureContacts(prev.contacts), createEmptyContact(false)],
    }));
  };

  const handleRemoveContact = (index: number) => {
    setForm((prev) => {
      const contacts = ensureContacts(prev.contacts).filter((_, idx) => idx !== index);
      return { ...prev, contacts: ensureContacts(contacts) };
    });
  };

  const handleBankFieldChange = (index: number, key: keyof SupplierBankAccountInput, value: string | boolean) => {
    setForm((prev) => {
      const accounts = ensureBankAccounts(prev.bankAccounts);
      accounts[index] = { ...accounts[index], [key]: value } as SupplierBankAccountInput;
      return { ...prev, bankAccounts: accounts };
    });
  };

  const handleSetPrimaryBank = (index: number) => {
    setForm((prev) => {
      const accounts = ensureBankAccounts(prev.bankAccounts).map((account, idx) => ({
        ...account,
        isPrimary: idx === index,
      }));
      return { ...prev, bankAccounts: accounts };
    });
  };

  const handleAddBankAccount = () => {
    setForm((prev) => ({
      ...prev,
      bankAccounts: [...ensureBankAccounts(prev.bankAccounts), createEmptyBank(false)],
    }));
  };

  const handleRemoveBankAccount = (index: number) => {
    setForm((prev) => {
      const accounts = ensureBankAccounts(prev.bankAccounts).filter((_, idx) => idx !== index);
      return { ...prev, bankAccounts: ensureBankAccounts(accounts) };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    const validationMessage = validateSupplierForm(form);
    if (validationMessage) {
      toast.error(validationMessage);
      return;
    }

    setSaving(true);
    try {
      const method = editingSupplier ? 'PUT' : 'POST';
      const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : '/api/suppliers';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? '保存供应商失败');
      }
      toast.success(editingSupplier ? '供应商已更新' : '供应商已创建');
      setDialogOpen(false);
      setEditingSupplier(null);
      setForm(createDefaultForm());
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('保存供应商失败', error);
      toast.error('保存失败', { description: error instanceof Error ? error.message : '请稍后再试' });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmDelete = (supplier: Supplier) => {
    setPendingDelete(supplier);
    setDeleteDialogOpen(true);
  };

  const handlePageChange = (direction: 'prev' | 'next') => {
    setPage((prev) => {
      if (direction === 'prev') {
        return Math.max(1, prev - 1);
      }
      return Math.min(totalPages, prev + 1);
    });
  };

  const handlePageSizeChange = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const handleDelete = async () => {
    if (!pendingDelete) return;
    try {
      const response = await fetch(`/api/suppliers/${pendingDelete.id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? '删除失败');
      }
      toast.success('供应商已删除');
      setRefreshKey((prev) => prev + 1);
    } catch (error) {
      console.error('删除供应商失败', error);
      toast.error('删除失败', { description: error instanceof Error ? error.message : '请稍后再试' });
    } finally {
      setDeleteDialogOpen(false);
      setPendingDelete(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          <div className={SUMMARY_CHIP_CLASS}>
            <span className="font-medium text-foreground">合作中</span>
            <span className="font-semibold text-chart-5">{stats.active}</span>
          </div>
          <div className={SUMMARY_CHIP_CLASS}>
            <span className="font-medium text-foreground">黑名单</span>
            <span className="font-semibold text-destructive">{stats.blacklisted}</span>
          </div>
          <div className={SUMMARY_CHIP_CLASS}>
            <span className="font-medium text-foreground">授信额度</span>
            <span className="font-semibold text-chart-4">{formattedCredit}</span>
          </div>
        </div>
        {canManage && (
          <Button onClick={handleOpenDialog} size="sm" className="gap-2">
            <PlusCircle className="h-4 w-4" /> 新增供应商
          </Button>
        )}
      </div>

      <div className="surface-toolbar p-4">
        <div className="flex flex-col gap-4 md:flex-row md:items-center">
          <Input
            placeholder="搜索名称 / 税号 / 联系方式"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
            className="h-10 md:max-w-xs"
          />
          <Select
            value={filterStatus}
            onValueChange={(value) => {
              setFilterStatus(value as typeof filterStatus);
              setPage(1);
            }}
          >
            <SelectTrigger className="h-10 md:w-40">
              <SelectValue placeholder="状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="active">正常合作</SelectItem>
              <SelectItem value="inactive">暂停</SelectItem>
              <SelectItem value="blacklisted">黑名单</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="h-10" onClick={() => setRefreshKey((prev) => prev + 1)} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : '刷新'}
          </Button>
        </div>
      </div>

      <div className="surface-table">
        <div className="md:hidden">
          <div className="space-y-3 p-4">
            {loading || permissionLoading ? (
              <div className="rounded-2xl border border-border/60 bg-background/70 p-6 text-center text-sm text-muted-foreground">
                数据加载中...
              </div>
            ) : suppliers.length ? (
              suppliers.map((supplier) => (
                <div key={supplier.id} className="rounded-2xl border border-border/60 bg-background/80 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{supplier.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{supplier.category || '未分类'}</div>
                    </div>
                    <Badge className={cn('text-xs', statusBadgeClass[supplier.status])}>{statusLabels[supplier.status]}</Badge>
                  </div>
                  <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center justify-between gap-3">
                      <span>联系人</span>
                      <span className="text-foreground">
                        {supplier.contacts?.length ? supplier.contacts[0].name : '未填写'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>联系方式</span>
                      <span className="text-foreground">
                        {supplier.contacts?.length ? (supplier.contacts[0].mobile || supplier.contacts[0].email || '—') : '—'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>付款信息</span>
                      <span className="text-foreground">
                        {supplier.bankAccounts?.length ? supplier.bankAccounts[0].bankName : '未配置'}
                      </span>
                    </div>
                  </div>
                  {canManage && (
                    <div className="mt-4 flex justify-end gap-2">
                      <Button variant="outline" size="sm" className="h-8 px-3" onClick={() => handleEditDialog(supplier)}>
                        编辑
                      </Button>
                      <Button variant="ghost" size="sm" className="h-8 px-3 text-destructive" onClick={() => handleConfirmDelete(supplier)}>
                        删除
                      </Button>
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 bg-background/60 p-6 text-center text-sm text-muted-foreground">
                暂无数据
              </div>
            )}
          </div>
        </div>
        <div className="hidden md:block">
        <Table
          stickyHeader
          scrollAreaClassName="max-h-[calc(100vh-350px)] custom-scrollbar"
          className="text-sm text-muted-foreground [&_tbody_tr]:hover:bg-muted/40"
        >
          <TableHeader className="[&_tr]:border-b border-border/40">
            <TableRow className="bg-muted/60 text-xs uppercase tracking-wide">
              <TableHead className="px-4 py-3">名称</TableHead>
              <TableHead className="px-4 py-3">分类</TableHead>
              <TableHead className="px-4 py-3">联系人</TableHead>
              <TableHead className="px-4 py-3">付款信息</TableHead>
              <TableHead className="px-4 py-3">状态</TableHead>
              {canManage && <TableHead className="px-4 py-3 text-right">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading || permissionLoading ? (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                  数据加载中...
                </TableCell>
              </TableRow>
            ) : suppliers.length ? (
              suppliers.map((supplier) => (
                <TableRow key={supplier.id} className="text-foreground">
                  <TableCell className="px-4 py-4 whitespace-normal">
                    <div className="font-medium text-foreground">{supplier.name}</div>
                    <div className="text-xs text-muted-foreground">{supplier.taxNumber || '—'}</div>
                  </TableCell>
                  <TableCell className="px-4 py-4">{supplier.category || '—'}</TableCell>
                  <TableCell className="px-4 py-4 whitespace-normal">
                    {supplier.contacts?.length ? (
                      <div className="text-sm">
                        <p>{supplier.contacts[0].name}</p>
                        <p className="text-xs text-muted-foreground">{supplier.contacts[0].mobile || supplier.contacts[0].email || '—'}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">未填写</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-4 whitespace-normal">
                    {supplier.bankAccounts?.length ? (
                      <div className="text-xs">
                        <p>{supplier.bankAccounts[0].bankName}</p>
                        <p className="text-muted-foreground">{supplier.bankAccounts[0].accountNumber}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">未配置</span>
                    )}
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <Badge className={cn('text-xs', statusBadgeClass[supplier.status])}>{statusLabels[supplier.status]}</Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="px-4 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => handleEditDialog(supplier)}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => handleConfirmDelete(supplier)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={canManage ? 6 : 5} className="px-6 py-12 text-center text-sm text-muted-foreground">
                  暂无数据
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-transparent px-2 py-4 text-sm text-muted-foreground md:flex-row md:items-center md:justify-between">
        <div>共 {total} 家供应商 • 第 {page} / {totalPages} 页</div>
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

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="max-h-[90vh] overflow-hidden p-0 sm:max-w-4xl">
          <form onSubmit={handleSubmit}>
            <ModalShell
              title={editingSupplier ? '编辑供应商' : '新增供应商'}
              description={supplierDialogDescription}
              className="max-h-[90vh]"
              footer={
                <DialogFooter className="gap-3">
                  <Button type="button" variant="outline" onClick={() => !saving && setDialogOpen(false)} disabled={saving}>
                    取消
                  </Button>
                  <Button type="submit" disabled={saving}>
                    {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {editingSupplier ? '保存变更' : '创建供应商'}
                  </Button>
                </DialogFooter>
              }
            >
              {dialogLoading ? (
                <div className="flex min-h-[240px] items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中...
                </div>
              ) : (
                <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">供应商名称</Label>
                  <Input id="name" value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="shortName">简称</Label>
                  <Input id="shortName" value={form.shortName ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, shortName: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">分类</Label>
                  <Input id="category" value={form.category ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>状态</Label>
                  <Select value={form.status ?? 'active'} onValueChange={(value) => setForm((prev) => ({ ...prev, status: value as SupplierStatus }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">正常合作</SelectItem>
                      <SelectItem value="inactive">暂停</SelectItem>
                      <SelectItem value="blacklisted">黑名单</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>付款条件</Label>
                  <Select value={form.paymentTerm ?? 'cash'} onValueChange={(value) => setForm((prev) => ({ ...prev, paymentTerm: value }))}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTerms.map((term) => (
                        <SelectItem key={term} value={term}>
                          {term.toUpperCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="creditLimit">授信额度 (CNY)</Label>
                  <Input
                    id="creditLimit"
                    type="number"
                    step="0.01"
                    value={form.creditLimit ?? 0}
                    onChange={(event) => setForm((prev) => ({ ...prev, creditLimit: Number(event.target.value) }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="invoiceTitle">发票抬头</Label>
                  <Input
                    id="invoiceTitle"
                    value={form.invoiceTitle ?? ''}
                    onChange={(event) => setForm((prev) => ({ ...prev, invoiceTitle: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="taxNumber">税号</Label>
                  <Input id="taxNumber" value={form.taxNumber ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, taxNumber: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="website">官网 / 链接</Label>
                  <Input id="website" value={form.website ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, website: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">座机</Label>
                  <Input id="phone" value={form.phone ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="mobile">手机</Label>
                  <Input id="mobile" value={form.mobile ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, mobile: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input id="email" type="email" value={form.email ?? ''} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="registeredAddress">注册地址</Label>
                  <Input
                    id="registeredAddress"
                    value={form.registeredAddress ?? ''}
                    onChange={(event) => setForm((prev) => ({ ...prev, registeredAddress: event.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="officeAddress">办公地址</Label>
                  <Input
                    id="officeAddress"
                    value={form.officeAddress ?? ''}
                    onChange={(event) => setForm((prev) => ({ ...prev, officeAddress: event.target.value }))}
                  />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="notes">备注</Label>
                  <Textarea
                    id="notes"
                    value={form.notes ?? ''}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    rows={3}
                  />
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">联系人</h3>
                    <p className="text-xs text-muted-foreground">至少保留一位联系人。</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddContact}>
                    添加联系人
                  </Button>
                </div>
                <div className="space-y-4">
                  {form.contacts?.map((contact, index) => (
                    <Card key={index} className="border-dashed">
                      <CardContent className="grid gap-3 py-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>姓名 *</Label>
                          <Input value={contact.name} onChange={(event) => handleContactFieldChange(index, 'name', event.target.value)} required />
                        </div>
                        <div className="space-y-2">
                          <Label>职务</Label>
                          <Input value={contact.role ?? ''} onChange={(event) => handleContactFieldChange(index, 'role', event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>手机</Label>
                          <Input value={contact.mobile ?? ''} onChange={(event) => handleContactFieldChange(index, 'mobile', event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>邮箱</Label>
                          <Input type="email" value={contact.email ?? ''} onChange={(event) => handleContactFieldChange(index, 'email', event.target.value)} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>备注</Label>
                          <Input value={contact.note ?? ''} onChange={(event) => handleContactFieldChange(index, 'note', event.target.value)} />
                        </div>
                        <div className="flex items-center justify-between md:col-span-2">
                          <div className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={`primary-contact-${editingSupplier?.id ?? 'new'}`}
                              checked={Boolean(contact.isPrimary)}
                              onChange={() => handleSetPrimaryContact(index)}
                              className="h-4 w-4 accent-primary"
                            />
                            <span>主联系人</span>
                          </div>
                          {form.contacts && form.contacts.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveContact(index)}>
                              删除
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-semibold">银行账户</h3>
                    <p className="text-xs text-muted-foreground">录入打款信息，支持多个账户。</p>
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={handleAddBankAccount}>
                    添加账户
                  </Button>
                </div>
                <div className="space-y-4">
                  {form.bankAccounts?.map((account, index) => (
                    <Card key={index} className="border-dashed">
                      <CardContent className="grid gap-3 py-4 md:grid-cols-2">
                        <div className="space-y-2">
                          <Label>开户行 *</Label>
                          <Input value={account.bankName} onChange={(event) => handleBankFieldChange(index, 'bankName', event.target.value)} required />
                        </div>
                        <div className="space-y-2">
                          <Label>账户名称 *</Label>
                          <Input value={account.accountName} onChange={(event) => handleBankFieldChange(index, 'accountName', event.target.value)} required />
                        </div>
                        <div className="space-y-2">
                          <Label>账号 *</Label>
                          <Input value={account.accountNumber} onChange={(event) => handleBankFieldChange(index, 'accountNumber', event.target.value)} required />
                        </div>
                        <div className="space-y-2">
                          <Label>支行</Label>
                          <Input value={account.branch ?? ''} onChange={(event) => handleBankFieldChange(index, 'branch', event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>币种</Label>
                          <Input value={account.currency ?? ''} onChange={(event) => handleBankFieldChange(index, 'currency', event.target.value)} />
                        </div>
                        <div className="space-y-2">
                          <Label>SWIFT</Label>
                          <Input value={account.swiftCode ?? ''} onChange={(event) => handleBankFieldChange(index, 'swiftCode', event.target.value)} />
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>备注</Label>
                          <Input value={account.note ?? ''} onChange={(event) => handleBankFieldChange(index, 'note', event.target.value)} />
                        </div>
                        <div className="flex items-center justify-between md:col-span-2">
                          <div className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={`primary-bank-${editingSupplier?.id ?? 'new'}`}
                              checked={Boolean(account.isPrimary)}
                              onChange={() => handleSetPrimaryBank(index)}
                              className="h-4 w-4 accent-primary"
                            />
                            <span>主账户</span>
                          </div>
                          {form.bankAccounts && form.bankAccounts.length > 1 && (
                            <Button type="button" variant="ghost" size="sm" onClick={() => handleRemoveBankAccount(index)}>
                              删除
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>

                </div>
              )}
            </ModalShell>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除供应商？</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `删除后将无法恢复：${pendingDelete.name}` : '该操作不可逆。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-white hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
