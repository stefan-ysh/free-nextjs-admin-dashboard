'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Edit2, Loader2, MoreHorizontal, PlusCircle, Trash2 } from 'lucide-react';

import { usePermissions } from '@/hooks/usePermissions';
import type { Client, ClientAddress, ClientContactInput, ClientPayload, ClientStatus, ClientType } from '@/types/client';
import { cn } from '@/lib/utils';
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
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const statusLabels: Record<ClientStatus, string> = {
  active: '正常往来',
  inactive: '暂停合作',
  blacklisted: '黑名单',
};

const statusBadgeClass: Record<ClientStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-100',
  inactive: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-100',
  blacklisted: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-100',
};

const typeLabels: Record<ClientType, string> = {
  personal: '个人客户',
  company: '企业客户',
};

const paymentTerms = ['cash', 't+7', 't+15', 't+30', 't+60', 'custom'] as const;
const createEmptyContact = (isPrimary = false): ClientContactInput => ({
  name: '',
  role: '',
  mobile: '',
  email: '',
  isPrimary,
});

const createDefaultForm = (): ClientPayload => ({
  type: 'company',
  displayName: '',
  companyName: '',
  contactPerson: '',
  mobile: '',
  email: '',
  taxNumber: '',
  invoiceTitle: '',
  paymentTerm: 't+30',
  creditLimit: 0,
  status: 'active',
  tags: [],
  source: 'manual',
  notes: '',
  contacts: [createEmptyContact(true)],
});

const normalizeContactsFromDetail = (contacts?: Client['contacts']): ClientContactInput[] => {
  if (!contacts || !contacts.length) {
    return [createEmptyContact(true)];
  }
  return contacts
    .sort((a, b) => (a.isPrimary === b.isPrimary ? 0 : a.isPrimary ? -1 : 1))
    .map((contact, index) => ({
      name: contact.name,
      role: contact.role ?? '',
      mobile: contact.mobile ?? '',
      email: contact.email ?? '',
      isPrimary: contact.isPrimary ?? index === 0,
    }));
};

const cloneContacts = (contacts?: ClientContactInput[]): ClientContactInput[] =>
  contacts ? contacts.map((contact) => ({ ...contact })) : [];

const ensureContactsArray = (contacts?: ClientContactInput[]): ClientContactInput[] => {
  const list = cloneContacts(contacts);
  if (!list.length) {
    list.push(createEmptyContact(true));
  }
  return list;
};

const cleanAddress = (address?: ClientAddress): ClientAddress | undefined => {
  if (!address) return undefined;
  const result: ClientAddress = {};
  (Object.keys(address) as (keyof ClientAddress)[]).forEach((key) => {
    const value = address[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed) {
        result[key] = trimmed;
      }
    }
  });
  return Object.keys(result).length ? result : undefined;
};

const sanitizeContactsForSubmit = (contacts?: ClientContactInput[]): ClientContactInput[] => {
  return ensureContactsArray(contacts)
    .map((contact, index) => {
      const name = contact.name?.trim() ?? '';
      const role = contact.role?.trim() ?? '';
      const mobile = contact.mobile?.trim() ?? '';
      const email = contact.email?.trim() ?? '';
      return {
        name,
        role: role || undefined,
        mobile: mobile || undefined,
        email: email || undefined,
        isPrimary: contact.isPrimary ?? index === 0,
      };
    })
    .filter((contact) => contact.name || contact.mobile || contact.email);
};

const sanitizeClientPayload = (form: ClientPayload): ClientPayload => {
  const displayName = form.displayName.trim();
  const companyName = form.companyName?.trim() || undefined;
  const contactPerson = form.contactPerson?.trim() || undefined;
  const mobile = form.mobile?.trim() || undefined;
  const email = form.email?.trim() || undefined;
  const taxNumber = form.taxNumber?.trim() || undefined;
  const invoiceTitle = form.invoiceTitle?.trim() || undefined;
  const notes = form.notes?.trim() || undefined;
  const billingAddress = cleanAddress(form.billingAddress);
  const shippingAddress = cleanAddress(form.shippingAddress);

  const sanitizedContacts = sanitizeContactsForSubmit(form.contacts);
  if (!sanitizedContacts.length) {
    const fallbackName = contactPerson || companyName || displayName;
    if (fallbackName || mobile || email) {
      sanitizedContacts.push({
        name: fallbackName || '默认联系人',
        mobile,
        email,
        isPrimary: true,
      });
    }
  }

  const primaryIndex = sanitizedContacts.findIndex((contact) => contact.isPrimary);
  sanitizedContacts.forEach((contact, index) => {
    contact.isPrimary = primaryIndex === -1 ? index === 0 : index === primaryIndex;
  });

  const payload: ClientPayload = {
    ...form,
    displayName,
    companyName,
    contactPerson,
    mobile,
    email,
    taxNumber,
    invoiceTitle,
    billingAddress,
    shippingAddress,
    notes,
    contacts: sanitizedContacts.length ? sanitizedContacts : undefined,
  };

  if (typeof payload.creditLimit !== 'number' || Number.isNaN(payload.creditLimit)) {
    payload.creditLimit = 0;
  }

  return payload;
};

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const mobilePattern = /^\+?[0-9\- ]{6,20}$/;

const isValidEmail = (value?: string): boolean => {
  if (!value) return true;
  return emailPattern.test(value);
};

const isValidMobile = (value?: string): boolean => {
  if (!value) return true;
  return mobilePattern.test(value);
};

const validateClientPayload = (payload: ClientPayload): string | null => {
  if (payload.mobile && !isValidMobile(payload.mobile)) {
    return '客户手机号格式不正确';
  }
  if (payload.email && !isValidEmail(payload.email)) {
    return '客户邮箱格式不正确';
  }
  if (payload.contacts && payload.contacts.length) {
    for (let i = 0; i < payload.contacts.length; i++) {
      const contact = payload.contacts[i];
      if (contact.mobile && !isValidMobile(contact.mobile)) {
        return `联系人“${contact.name || `#${i + 1}`}”手机号格式不正确`;
      }
      if (contact.email && !isValidEmail(contact.email)) {
        return `联系人“${contact.name || `#${i + 1}`}”邮箱格式不正确`;
      }
    }
  }
  return null;
};

function formatCurrency(value: number | undefined | null) {
  if (!value) return '¥0.00';
  return `¥${value.toFixed(2)}`;
}

export default function ClientManagementPage() {
  const { hasPermission, loading: permissionLoading } = usePermissions();
  const canManage = hasPermission('CLIENT_MANAGE');
  const canView = hasPermission('CLIENT_VIEW');

  const [clients, setClients] = useState<Client[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [form, setForm] = useState<ClientPayload>(() => createDefaultForm());
  const [saving, setSaving] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<'all' | ClientType>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | ClientStatus>('all');
  const [refreshKey, setRefreshKey] = useState(0);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<Client | null>(null);

  const stats = useMemo(() => {
    const active = clients.filter((client) => client.status === 'active').length;
    const blacklisted = clients.filter((client) => client.status === 'blacklisted').length;
    const totalCredit = clients.reduce((sum, client) => sum + Number(client.creditLimit || 0), 0);
    const outstanding = clients.reduce((sum, client) => sum + Number(client.outstandingAmount || 0), 0);
    return { active, blacklisted, totalCredit, outstanding };
  }, [clients]);

  const loadClients = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('pageSize', '50');
      if (search.trim()) params.set('search', search.trim());
      if (filterType !== 'all') params.set('type', filterType);
      if (filterStatus !== 'all') params.set('status', filterStatus);
      const response = await fetch(`/api/clients?${params.toString()}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? '加载客户失败');
      }
      setClients(payload.data.items ?? []);
      setTotal(payload.data.total ?? 0);
    } catch (error) {
      console.error('加载客户失败', error);
      toast.error('加载失败', { description: error instanceof Error ? error.message : '请稍后再试' });
      setClients([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [canView, filterStatus, filterType, search, toast]);

  useEffect(() => {
    loadClients();
  }, [loadClients, refreshKey]);

  const handleOpenDialog = () => {
    setEditingClient(null);
    setForm(createDefaultForm());
    setDialogLoading(false);
    setDialogOpen(true);
  };

  const handleEditDialog = async (client: Client) => {
    setDialogOpen(true);
    setDialogLoading(true);
    setEditingClient(client);
    try {
      const response = await fetch(`/api/clients/${client.id}`, { cache: 'no-store' });
      const payload = await response.json();
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? '加载客户详情失败');
      }
      const detail = payload.data as Client;
      setEditingClient(detail);
      setForm({
        type: detail.type,
        displayName: detail.displayName,
        companyName: detail.companyName ?? '',
        contactPerson: detail.contactPerson ?? '',
        mobile: detail.mobile ?? '',
        email: detail.email ?? '',
        taxNumber: detail.taxNumber ?? '',
        invoiceTitle: detail.invoiceTitle ?? '',
        billingAddress: detail.billingAddress,
        shippingAddress: detail.shippingAddress,
        paymentTerm: detail.paymentTerm ?? 'cash',
        creditLimit: detail.creditLimit ?? 0,
        tags: detail.tags ?? [],
        status: detail.status,
        source: detail.source,
        notes: detail.notes ?? '',
        contacts: ensureContactsArray(normalizeContactsFromDetail(detail.contacts)),
      });
    } catch (error) {
      console.error('加载客户详情失败', error);
      toast.error('加载客户详情失败', { description: error instanceof Error ? error.message : '请稍后再试' });
      setDialogOpen(false);
      setEditingClient(null);
    } finally {
      setDialogLoading(false);
    }
  };

  const handleFormChange = <K extends keyof ClientPayload>(key: K, value: ClientPayload[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddressFieldChange = (
    addressType: 'billingAddress' | 'shippingAddress',
    field: keyof ClientAddress,
    value: string,
  ) => {
    setForm((prev) => {
      const current = prev[addressType] ?? {};
      const updated: ClientAddress = { ...current, [field]: value };
      return { ...prev, [addressType]: updated } as ClientPayload;
    });
  };

  const handleContactFieldChange = <K extends keyof ClientContactInput>(index: number, key: K, value: ClientContactInput[K]) => {
    setForm((prev) => {
      const contacts = ensureContactsArray(prev.contacts);
      contacts[index] = { ...contacts[index], [key]: value };
      return { ...prev, contacts };
    });
  };

  const handleAddContact = () => {
    setForm((prev) => {
      const contacts = ensureContactsArray(prev.contacts);
      contacts.push(createEmptyContact(false));
      return { ...prev, contacts };
    });
  };

  const handleRemoveContact = (index: number) => {
    setForm((prev) => {
      let contacts = ensureContactsArray(prev.contacts).filter((_, idx) => idx !== index);
      if (!contacts.length) {
        contacts = [createEmptyContact(true)];
      } else if (!contacts.some((contact) => contact.isPrimary)) {
        contacts = contacts.map((contact, idx) => ({ ...contact, isPrimary: idx === 0 }));
      }
      return { ...prev, contacts };
    });
  };

  const handleSetPrimaryContact = (index: number) => {
    setForm((prev) => {
      const contacts = ensureContactsArray(prev.contacts).map((contact, idx) => ({
        ...contact,
        isPrimary: idx === index,
      }));
      return { ...prev, contacts };
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    if (!form.displayName.trim()) {
      toast.error('请填写客户名称');
      return;
    }
    if (form.type === 'company' && !form.invoiceTitle?.trim()) {
      toast.error('企业客户需填写发票抬头');
      return;
    }
    setSaving(true);
    try {
      const payloadForSubmit = sanitizeClientPayload(form);
      const validationError = validateClientPayload(payloadForSubmit);
      if (validationError) {
        toast.error('数据校验失败', { description: validationError });
        setSaving(false);
        return;
      }
      const endpoint = editingClient ? `/api/clients/${editingClient.id}` : '/api/clients';
      const method = editingClient ? 'PATCH' : 'POST';
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payloadForSubmit),
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? '保存失败');
      }
      toast.success(editingClient ? '客户信息已更新' : '客户创建成功');
      setDialogOpen(false);
      setEditingClient(null);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      toast.error('保存失败', { description: error instanceof Error ? error.message : '请稍后再试' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (client: Client) => {
    if (!canManage) return;
    setDeletingId(client.id);
    try {
      const response = await fetch(`/api/clients/${client.id}`, { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? '删除失败');
      }
      toast.success('客户已删除');
      setRefreshKey((key) => key + 1);
    } catch (error) {
      toast.error('删除失败', { description: error instanceof Error ? error.message : '请稍后再试' });
    } finally {
      setDeletingId(null);
    }
  };

  const handleDeleteClick = (client: Client) => {
    setPendingDelete(client);
    setDeleteDialogOpen(true);
  };

  const handleCloseDeleteDialog = () => {
    if (deletingId) return;
    setDeleteDialogOpen(false);
    setPendingDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    await handleDelete(pendingDelete);
    setDeleteDialogOpen(false);
    setPendingDelete(null);
  };

  if (permissionLoading) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> 正在校验权限...
        </CardContent>
      </Card>
    );
  }

  if (!canView) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-muted-foreground">当前账号无权查看客户数据</CardContent>
      </Card>
    );
  }

  const columnCount = canManage ? 8 : 7;
  const dialogTitle = editingClient ? '编辑客户' : '新增客户';
  const dialogDescription = editingClient ? '更新客户档案，保存后立即生效。' : '完善客户档案，可直接在出库单引用。';
  const submitLabel = editingClient ? '保存修改' : '保存客户';
  const contactsList = form.contacts && form.contacts.length ? form.contacts : [createEmptyContact(true)];
  const formDisabled = saving || dialogLoading;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
          <span className="font-medium text-foreground">客户总数</span>
          <span className="font-semibold text-blue-600 dark:text-blue-400">{total}</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
          <span className="font-medium text-foreground">活跃客户</span>
          <span className="font-semibold text-emerald-600 dark:text-emerald-400">{stats.active}</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
          <span className="font-medium text-foreground">在途额度</span>
          <span className="font-semibold text-amber-600 dark:text-amber-400">{formatCurrency(stats.outstanding)}</span>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/80 bg-card/60 px-3 py-1.5 text-[11px] text-muted-foreground shadow-sm">
          <span className="font-medium text-foreground">授信总额</span>
          <span className="font-semibold text-purple-600 dark:text-purple-400">{formatCurrency(stats.totalCredit)}</span>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-3 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end">
          <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-3 lg:gap-4">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">搜索</span>
              <Input
                placeholder="搜索客户名称/手机号/税号"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="h-9 text-sm"
              />
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">客户类型</span>
              <Select value={filterType} onValueChange={(value) => setFilterType(value as 'all' | ClientType)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="全部类型" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部类型</SelectItem>
                  <SelectItem value="personal">个人客户</SelectItem>
                  <SelectItem value="company">企业客户</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">状态</span>
              <Select value={filterStatus} onValueChange={(value) => setFilterStatus(value as 'all' | ClientStatus)}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="全部状态" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部状态</SelectItem>
                  <SelectItem value="active">正常往来</SelectItem>
                  <SelectItem value="inactive">暂停合作</SelectItem>
                  <SelectItem value="blacklisted">黑名单</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center pt-1">
            {canManage && (
              <Button onClick={handleOpenDialog} size="sm" className="h-9">
                <PlusCircle className="mr-2 h-4 w-4" /> 新增客户
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <Table className="[&_tbody_tr]:hover:bg-muted/40">
          <TableHeader className="[&_tr]:border-b border-border/40">
            <TableRow>
              <TableHead>客户名称</TableHead>
              <TableHead>类型</TableHead>
              <TableHead>联系方式</TableHead>
              <TableHead>税号 / 发票抬头</TableHead>
              <TableHead className="text-right">授信额度</TableHead>
              <TableHead className="text-right">在途金额</TableHead>
              <TableHead className="text-center">状态</TableHead>
              {canManage && <TableHead className="text-right">操作</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody className="[&_tr]:border-0">
            {loading && (
              <TableRow>
                <TableCell colSpan={columnCount} className="py-6 text-center text-muted-foreground">
                  <Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> 正在加载...
                </TableCell>
              </TableRow>
            )}
            {!loading && clients.length === 0 && (
              <TableRow>
                <TableCell colSpan={columnCount} className="py-6 text-center text-muted-foreground">
                  暂无客户数据，点击“新增客户”开始维护
                </TableCell>
              </TableRow>
            )}
            {!loading &&
              clients.map((client) => (
                <TableRow key={client.id}>
                  <TableCell>
                    <div className="font-medium">{client.displayName}</div>
                    {client.contactPerson && (
                      <div className="text-xs text-muted-foreground">联系人：{client.contactPerson}</div>
                    )}
                  </TableCell>
                  <TableCell>{typeLabels[client.type]}</TableCell>
                  <TableCell>
                    <div className="text-sm">{client.mobile || '—'}</div>
                    <div className="text-xs text-muted-foreground">{client.email || '—'}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{client.taxNumber || '—'}</div>
                    <div className="text-xs text-muted-foreground">{client.invoiceTitle || '—'}</div>
                  </TableCell>
                  <TableCell className="text-right">{formatCurrency(client.creditLimit)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(client.outstandingAmount)}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary" className={cn('px-3 py-1 text-xs', statusBadgeClass[client.status])}>
                      {statusLabels[client.status]}
                    </Badge>
                  </TableCell>
                  {canManage && (
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-32">
                          <DropdownMenuItem onClick={() => handleEditDialog(client)}>
                            <Edit2 className="mr-2 h-4 w-4" /> 编辑
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDeleteClick(client)}
                            className="text-rose-600 focus:text-rose-600"
                            disabled={deletingId === client.id}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            {deletingId === client.id ? '删除中...' : '删除'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(open) => !saving && setDialogOpen(open)}>
        <DialogContent className="p-0 sm:max-w-3xl">
          <form onSubmit={handleSubmit} className="flex max-h-[90vh] flex-col">
            <div className="border-b px-6 py-4">
              <DialogHeader>
                <DialogTitle>{dialogTitle}</DialogTitle>
                <DialogDescription>{dialogDescription}</DialogDescription>
              </DialogHeader>
            </div>
            <div className="flex-1 overflow-y-auto">
              {dialogLoading ? (
                <div className="flex h-full items-center justify-center py-12 text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 正在加载客户详情...
                </div>
              ) : (
                <div className="space-y-4 px-6 py-4">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>客户类型</Label>
                      <Select
                        value={form.type}
                        onValueChange={(value) => handleFormChange('type', value as ClientType)}
                        disabled={formDisabled}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="company">企业客户</SelectItem>
                          <SelectItem value="personal">个人客户</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>客户状态</Label>
                      <Select
                        value={form.status}
                        onValueChange={(value) => handleFormChange('status', value as ClientStatus)}
                        disabled={formDisabled}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="active">正常往来</SelectItem>
                          <SelectItem value="inactive">暂停合作</SelectItem>
                          <SelectItem value="blacklisted">黑名单</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>客户名称</Label>
                      <Input
                        value={form.displayName}
                        onChange={(event) => handleFormChange('displayName', event.target.value)}
                        required
                        disabled={formDisabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{form.type === 'company' ? '公司全称' : '联系人'}</Label>
                      <Input
                        value={form.type === 'company' ? form.companyName ?? '' : form.contactPerson ?? ''}
                        onChange={(event) =>
                          form.type === 'company'
                            ? handleFormChange('companyName', event.target.value)
                            : handleFormChange('contactPerson', event.target.value)
                        }
                        disabled={formDisabled}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>手机号</Label>
                      <Input
                        value={form.mobile ?? ''}
                        onChange={(event) => handleFormChange('mobile', event.target.value)}
                        disabled={formDisabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>邮箱</Label>
                      <Input
                        value={form.email ?? ''}
                        onChange={(event) => handleFormChange('email', event.target.value)}
                        disabled={formDisabled}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>纳税人识别号</Label>
                      <Input
                        value={form.taxNumber ?? ''}
                        onChange={(event) => handleFormChange('taxNumber', event.target.value)}
                        disabled={formDisabled}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>发票抬头</Label>
                      <Input
                        value={form.invoiceTitle ?? ''}
                        onChange={(event) => handleFormChange('invoiceTitle', event.target.value)}
                        disabled={formDisabled}
                      />
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>结算方式</Label>
                      <Select value={form.paymentTerm} onValueChange={(value) => handleFormChange('paymentTerm', value)} disabled={formDisabled}>
                        <SelectTrigger>
                          <SelectValue placeholder="选择结算方式" />
                        </SelectTrigger>
                        <SelectContent>
                          {paymentTerms.map((term) => (
                            <SelectItem key={term} value={term}>
                              {term === 'cash' ? '现结' : term.toUpperCase()}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>授信额度</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1000}
                        value={form.creditLimit ?? 0}
                        onChange={(event) => handleFormChange('creditLimit', Number(event.target.value))}
                        disabled={formDisabled}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>备注</Label>
                    <Textarea
                      rows={3}
                      value={form.notes ?? ''}
                      onChange={(event) => handleFormChange('notes', event.target.value)}
                      disabled={formDisabled}
                    />
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="mb-3">
                      <div className="font-medium">开票地址</div>
                      <p className="text-sm text-muted-foreground">用于纸质发票、合同邮寄，可选填。</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>国家/地区</Label>
                        <Input
                          value={form.billingAddress?.country ?? ''}
                          onChange={(event) => handleAddressFieldChange('billingAddress', 'country', event.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>省份</Label>
                        <Input
                          value={form.billingAddress?.province ?? ''}
                          onChange={(event) => handleAddressFieldChange('billingAddress', 'province', event.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>城市</Label>
                        <Input
                          value={form.billingAddress?.city ?? ''}
                          onChange={(event) => handleAddressFieldChange('billingAddress', 'city', event.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>区县</Label>
                        <Input
                          value={form.billingAddress?.district ?? ''}
                          onChange={(event) => handleAddressFieldChange('billingAddress', 'district', event.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>邮编</Label>
                        <Input
                          value={form.billingAddress?.zipcode ?? ''}
                          onChange={(event) => handleAddressFieldChange('billingAddress', 'zipcode', event.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>联系人</Label>
                        <Input
                          value={form.billingAddress?.contact ?? ''}
                          onChange={(event) => handleAddressFieldChange('billingAddress', 'contact', event.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>联系电话</Label>
                        <Input
                          value={form.billingAddress?.phone ?? ''}
                          onChange={(event) => handleAddressFieldChange('billingAddress', 'phone', event.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                    </div>
                    <div className="space-y-2 pt-2">
                      <Label>街道地址</Label>
                      <Textarea
                        rows={2}
                        value={form.billingAddress?.street ?? ''}
                        onChange={(event) => handleAddressFieldChange('billingAddress', 'street', event.target.value)}
                        disabled={formDisabled}
                      />
                    </div>
                  </div>

                  <div className="rounded-lg border p-4">
                    <div className="mb-3">
                      <div className="font-medium">收货地址</div>
                      <p className="text-sm text-muted-foreground">用于发货或现场服务，可选填。</p>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>国家/地区</Label>
                        <Input
                          value={form.shippingAddress?.country ?? ''}
                          onChange={(event) => handleAddressFieldChange('shippingAddress', 'country', event.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>省份</Label>
                        <Input
                          value={form.shippingAddress?.province ?? ''}
                          onChange={(event) => handleAddressFieldChange('shippingAddress', 'province', event.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>城市</Label>
                        <Input
                          value={form.shippingAddress?.city ?? ''}
                          onChange={(event) => handleAddressFieldChange('shippingAddress', 'city', event.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>区县</Label>
                        <Input
                          value={form.shippingAddress?.district ?? ''}
                          onChange={(event) => handleAddressFieldChange('shippingAddress', 'district', event.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>邮编</Label>
                        <Input
                          value={form.shippingAddress?.zipcode ?? ''}
                          onChange={(event) => handleAddressFieldChange('shippingAddress', 'zipcode', event.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>联系人</Label>
                        <Input
                          value={form.shippingAddress?.contact ?? ''}
                          onChange={(event) => handleAddressFieldChange('shippingAddress', 'contact', event.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>联系电话</Label>
                        <Input
                          value={form.shippingAddress?.phone ?? ''}
                          onChange={(event) => handleAddressFieldChange('shippingAddress', 'phone', event.target.value)}
                          disabled={formDisabled}
                        />
                      </div>
                    </div>
                    <div className="space-y-2 pt-2">
                      <Label>街道地址</Label>
                      <Textarea
                        rows={2}
                        value={form.shippingAddress?.street ?? ''}
                        onChange={(event) => handleAddressFieldChange('shippingAddress', 'street', event.target.value)}
                        disabled={formDisabled}
                      />
                    </div>
                  </div>

                  <div className="space-y-4 rounded-lg border p-4">
                    <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <div className="font-medium">联系人</div>
                        <p className="text-sm text-muted-foreground">维护主联系人及备用联系人，便于财务与业务跟进。</p>
                      </div>
                      <Button type="button" variant="outline" size="sm" onClick={handleAddContact} disabled={formDisabled}>
                        <PlusCircle className="mr-2 h-4 w-4" /> 添加联系人
                      </Button>
                    </div>
                    <div className="space-y-4">
                      {contactsList.map((contact, index) => (
                        <div key={index} className="space-y-3 rounded-lg border p-4">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <div className="flex items-center gap-2 text-sm font-medium">
                              联系人 {index + 1}
                              {contact.isPrimary && <Badge variant="secondary">主联系人</Badge>}
                            </div>
                            <div className="flex gap-2">
                              {!contact.isPrimary && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleSetPrimaryContact(index)}
                                  disabled={formDisabled}
                                >
                                  设为主联系人
                                </Button>
                              )}
                              {contactsList.length > 1 && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleRemoveContact(index)}
                                  disabled={formDisabled}
                                  className="text-rose-600 hover:text-rose-600"
                                >
                                  <Trash2 className="mr-1 h-4 w-4" /> 删除
                                </Button>
                              )}
                            </div>
                          </div>
                          <div className="grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <Label>姓名</Label>
                              <Input
                                value={contact.name ?? ''}
                                onChange={(event) => handleContactFieldChange(index, 'name', event.target.value)}
                                disabled={formDisabled}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>职位</Label>
                              <Input
                                value={contact.role ?? ''}
                                onChange={(event) => handleContactFieldChange(index, 'role', event.target.value)}
                                disabled={formDisabled}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>手机号</Label>
                              <Input
                                value={contact.mobile ?? ''}
                                onChange={(event) => handleContactFieldChange(index, 'mobile', event.target.value)}
                                disabled={formDisabled}
                              />
                            </div>
                            <div className="space-y-2">
                              <Label>邮箱</Label>
                              <Input
                                value={contact.email ?? ''}
                                onChange={(event) => handleContactFieldChange(index, 'email', event.target.value)}
                                disabled={formDisabled}
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-3 border-t px-6 py-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)} disabled={formDisabled}>
                取消
              </Button>
              <Button type="submit" disabled={formDisabled}>
                {saving ? '保存中...' : submitLabel}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={(open) => (open ? setDeleteDialogOpen(true) : handleCloseDeleteDialog())}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除客户</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingDelete ? `删除“${pendingDelete.displayName}”后可重新创建，相关记录将不可恢复。` : '删除后可重新创建客户。'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCloseDeleteDialog} disabled={Boolean(deletingId)}>
              取消
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmDelete} disabled={Boolean(deletingId)}>
              {pendingDelete && deletingId === pendingDelete.id ? '删除中...' : '确认删除'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
