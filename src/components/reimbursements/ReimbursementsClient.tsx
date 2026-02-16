'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import FileUpload from '@/components/common/FileUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Drawer, DrawerBody, DrawerContent, DrawerFooter, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Textarea } from '@/components/ui/textarea';
import { usePermissions } from '@/hooks/usePermissions';
import type {
  CreateReimbursementInput,
  ListReimbursementsResult,
  ReimbursementOrganizationType,
  ReimbursementRecord,
  ReimbursementSourceType,
  UpdateReimbursementInput,
} from '@/types/reimbursement';
import { REIMBURSEMENT_CATEGORY_OPTIONS } from '@/types/reimbursement';
import { UserRole } from '@/types/user';
import type { PurchaseRecord } from '@/types/purchase';

type ListResponse = { success: boolean; data?: ListReimbursementsResult; error?: string };
type ActionResponse = { success: boolean; data?: ReimbursementRecord; error?: string };
type PurchaseListResponse = {
  success: boolean;
  data?: { items: PurchaseRecord[]; total: number; page: number; pageSize: number };
  error?: string;
};

type EligibilityResponse = {
  success: boolean;
  data?: { eligible: boolean; reason?: string };
  error?: string;
};

type ReimbursementFormState = CreateReimbursementInput;

const STATUS_LABELS: Record<ReimbursementRecord['status'], string> = {
  draft: '草稿',
  pending_approval: '待审批',
  approved: '已审批',
  rejected: '已驳回',
  paid: '已打款',
};

const SOURCE_LABELS: Record<ReimbursementSourceType, string> = {
  purchase: '关联采购',
  direct: '直接报销',
};

const ORG_LABELS: Record<ReimbursementOrganizationType, string> = {
  school: '学校',
  company: '单位',
};

const STATUS_STYLES: Record<ReimbursementRecord['status'], string> = {
  draft: 'border-border/80 text-muted-foreground',
  pending_approval: 'border-chart-3/40 text-chart-3 bg-chart-3/10',
  approved: 'border-chart-1/40 text-chart-1 bg-chart-1/10',
  rejected: 'border-destructive/40 text-destructive bg-destructive/10',
  paid: 'border-chart-5/40 text-chart-5 bg-chart-5/10',
};

const MONEY = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY' });

function toDateInputValue(value?: string | null): string {
  if (!value) return '';
  return value.slice(0, 10);
}

function buildDefaultForm(): ReimbursementFormState {
  return {
    sourceType: 'direct',
    category: '交通',
    title: '',
    amount: 0,
    occurredAt: toDateInputValue(new Date().toISOString()),
    organizationType: 'company',
    sourcePurchaseId: '',
    description: '',
    invoiceImages: [],
    receiptImages: [],
    attachments: [],
  };
}

function hasReimbursementEvidence(row: Pick<ReimbursementRecord, 'invoiceImages' | 'receiptImages'>): boolean {
  return row.invoiceImages.length > 0 || row.receiptImages.length > 0;
}

export default function ReimbursementsClient() {
  const { user, hasPermission } = usePermissions();
  const [records, setRecords] = useState<ReimbursementRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [scope, setScope] = useState<'mine' | 'approval' | 'pay' | 'all'>('mine');
  const [search, setSearch] = useState('');

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ReimbursementFormState>(buildDefaultForm);

  const [purchaseOptions, setPurchaseOptions] = useState<PurchaseRecord[]>([]);
  const [purchaseLoading, setPurchaseLoading] = useState(false);
  const [purchaseSearch, setPurchaseSearch] = useState('');

  const [eligibilityChecking, setEligibilityChecking] = useState(false);
  const [eligibility, setEligibility] = useState<{ eligible: boolean; reason?: string } | null>(null);

  const canCreate = hasPermission('REIMBURSEMENT_CREATE');
  const canApprove = hasPermission('REIMBURSEMENT_APPROVE');
  const canPay = hasPermission('REIMBURSEMENT_PAY');
  const canViewAll = hasPermission('REIMBURSEMENT_VIEW_ALL');

  const scopeOptions = useMemo(() => {
    const options: Array<{ value: 'mine' | 'approval' | 'pay' | 'all'; label: string }> = [{ value: 'mine', label: '我的报销' }];
    if (canApprove) options.push({ value: 'approval', label: '待我审批' });
    if (canPay) options.push({ value: 'pay', label: '待我打款' });
    if (canViewAll) options.push({ value: 'all', label: '全部报销' });
    return options;
  }, [canApprove, canPay, canViewAll]);

  const role = user?.primaryRole;

  const canOperatePay = useCallback(
    (row: ReimbursementRecord) => {
      if (!canPay || row.status !== 'approved') return false;
      if (role === UserRole.FINANCE_SCHOOL) return row.organizationType === 'school';
      if (role === UserRole.FINANCE_COMPANY) return row.organizationType === 'company';
      return false;
    },
    [canPay, role]
  );

  const isOwner = useCallback(
    (row: ReimbursementRecord) => row.createdBy === user?.id || row.applicantId === user?.id,
    [user?.id]
  );

  const editable = useCallback(
    (row: ReimbursementRecord) => isOwner(row) && (row.status === 'draft' || row.status === 'rejected'),
    [isOwner]
  );

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('scope', scope);
      params.set('page', '1');
      params.set('pageSize', '50');
      if (search.trim()) params.set('search', search.trim());
      const response = await fetch(`/api/reimbursements?${params.toString()}`, { headers: { Accept: 'application/json' } });
      const payload = (await response.json()) as ListResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? '加载报销列表失败');
      }
      setRecords(payload.data.items);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载报销列表失败');
    } finally {
      setLoading(false);
    }
  }, [scope, search]);

  const fetchPurchases = useCallback(async () => {
    setPurchaseLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', '1');
      params.set('pageSize', '100');
      params.set('sortBy', 'updatedAt');
      params.set('sortOrder', 'desc');
      const response = await fetch(`/api/purchases?${params.toString()}`, { headers: { Accept: 'application/json' } });
      const payload = (await response.json()) as PurchaseListResponse;
      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(payload.error ?? '加载采购单失败');
      }
      const options = payload.data.items.filter((item) => item.status === 'approved' || item.status === 'paid');
      setPurchaseOptions(options);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '加载采购单失败');
      setPurchaseOptions([]);
    } finally {
      setPurchaseLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchList();
  }, [fetchList]);

  useEffect(() => {
    if (!drawerOpen || form.sourceType !== 'purchase') return;
    void fetchPurchases();
  }, [drawerOpen, form.sourceType, fetchPurchases]);

  useEffect(() => {
    if (!drawerOpen || form.sourceType !== 'purchase' || !form.sourcePurchaseId?.trim()) {
      setEligibility(null);
      return;
    }

    let cancelled = false;
    setEligibilityChecking(true);
    void fetch(`/api/reimbursements/purchase-eligibility?purchaseId=${encodeURIComponent(form.sourcePurchaseId.trim())}`, {
      headers: { Accept: 'application/json' },
    })
      .then(async (response) => {
        const payload = (await response.json()) as EligibilityResponse;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error ?? '关联采购校验失败');
        }
        if (cancelled) return;
        setEligibility(payload.data);
      })
      .catch((error) => {
        if (cancelled) return;
        setEligibility({ eligible: false, reason: error instanceof Error ? error.message : '关联采购校验失败' });
      })
      .finally(() => {
        if (!cancelled) setEligibilityChecking(false);
      });

    return () => {
      cancelled = true;
    };
  }, [drawerOpen, form.sourceType, form.sourcePurchaseId]);

  const runAction = useCallback(
    async (id: string, action: 'submit' | 'approve' | 'reject' | 'pay' | 'withdraw', body: Record<string, unknown> = {}) => {
      const response = await fetch(`/api/reimbursements/${id}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...body }),
      });
      const payload = (await response.json()) as ActionResponse;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error ?? '操作失败');
      }
      return payload.data ?? null;
    },
    []
  );

  const resetForm = useCallback(() => {
    setEditingId(null);
    setPurchaseSearch('');
    setEligibility(null);
    setForm(buildDefaultForm());
  }, []);

  const openCreateDrawer = useCallback(() => {
    resetForm();
    setDrawerOpen(true);
  }, [resetForm]);

  const openEditDrawer = useCallback((row: ReimbursementRecord) => {
    setEditingId(row.id);
    setPurchaseSearch('');
    setEligibility(null);
    setForm({
      sourceType: row.sourceType,
      sourcePurchaseId: row.sourcePurchaseId ?? '',
      organizationType: row.organizationType,
      category: row.category,
      title: row.title,
      amount: row.amount,
      occurredAt: toDateInputValue(row.occurredAt),
      description: row.description ?? '',
      invoiceImages: row.invoiceImages,
      receiptImages: row.receiptImages,
      attachments: row.attachments,
    });
    setDrawerOpen(true);
  }, []);

  const submitForm = useCallback(async () => {
    setSubmitting(true);
    try {
      const payloadBase: CreateReimbursementInput = {
        ...form,
        title: form.title.trim(),
        category: form.category.trim(),
        amount: Number(form.amount),
        occurredAt: form.occurredAt,
        sourcePurchaseId: form.sourceType === 'purchase' ? form.sourcePurchaseId?.trim() || '' : undefined,
        description: form.description?.trim() || undefined,
        invoiceImages: form.invoiceImages ?? [],
        receiptImages: form.receiptImages ?? [],
        attachments: form.attachments ?? [],
      };

      if (!payloadBase.title) {
        throw new Error('请填写报销标题');
      }
      if (!payloadBase.category) {
        throw new Error('请选择报销分类');
      }
      if (!Number.isFinite(payloadBase.amount) || payloadBase.amount <= 0) {
        throw new Error('报销金额必须大于 0');
      }
      if (payloadBase.sourceType === 'purchase' && !payloadBase.sourcePurchaseId) {
        throw new Error('请选择关联采购单');
      }

      if (editingId) {
        const response = await fetch(`/api/reimbursements/${editingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBase as UpdateReimbursementInput),
        });
        const body = (await response.json()) as ActionResponse;
        if (!response.ok || !body.success || !body.data) {
          throw new Error(body.error ?? '更新报销失败');
        }
        toast.success('报销草稿已更新');
      } else {
        const response = await fetch('/api/reimbursements', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payloadBase),
        });
        const body = (await response.json()) as ActionResponse;
        if (!response.ok || !body.success || !body.data) {
          throw new Error(body.error ?? '创建报销失败');
        }
        toast.success('报销草稿已创建');
      }

      setDrawerOpen(false);
      resetForm();
      await fetchList();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : '保存失败');
    } finally {
      setSubmitting(false);
    }
  }, [editingId, fetchList, form, resetForm]);

  const handleDelete = useCallback(
    async (row: ReimbursementRecord) => {
      if (!editable(row)) return;
      const confirmed = window.confirm('确认删除这条报销草稿？删除后不可恢复。');
      if (!confirmed) return;
      try {
        const response = await fetch(`/api/reimbursements/${row.id}`, { method: 'DELETE' });
        const body = (await response.json()) as { success: boolean; error?: string };
        if (!response.ok || !body.success) {
          throw new Error(body.error ?? '删除失败');
        }
        toast.success('报销草稿已删除');
        await fetchList();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '删除失败');
      }
    },
    [editable, fetchList]
  );

  const handleSubmit = useCallback(
    async (row: ReimbursementRecord) => {
      if (!hasReimbursementEvidence(row)) {
        toast.error('请先上传发票或收款凭证后再提交');
        openEditDrawer(row);
        return;
      }
      try {
        await runAction(row.id, 'submit');
        toast.success('已提交审批');
        await fetchList();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '提交失败');
      }
    },
    [fetchList, openEditDrawer, runAction]
  );

  const handleApprove = useCallback(
    async (row: ReimbursementRecord) => {
      try {
        await runAction(row.id, 'approve');
        toast.success('审批通过');
        await fetchList();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '审批失败');
      }
    },
    [fetchList, runAction]
  );

  const handleReject = useCallback(
    async (row: ReimbursementRecord) => {
      const reason = window.prompt('请输入驳回原因');
      if (!reason) return;
      try {
        await runAction(row.id, 'reject', { reason });
        toast.success('已驳回');
        await fetchList();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '驳回失败');
      }
    },
    [fetchList, runAction]
  );

  const handlePay = useCallback(
    async (row: ReimbursementRecord) => {
      const note = window.prompt('打款备注（可选）') ?? '';
      try {
        await runAction(row.id, 'pay', { note });
        toast.success('已标记打款');
        await fetchList();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : '打款失败');
      }
    },
    [fetchList, runAction]
  );

  const purchaseMap = useMemo(() => new Map(purchaseOptions.map((item) => [item.id, item])), [purchaseOptions]);

  const selectedPurchase = form.sourceType === 'purchase' ? purchaseMap.get(form.sourcePurchaseId?.trim() || '') ?? null : null;

  const filteredPurchases = useMemo(() => {
    const keyword = purchaseSearch.trim().toLowerCase();
    if (!keyword) return purchaseOptions;
    return purchaseOptions.filter((item) => {
      const text = `${item.purchaseNumber} ${item.itemName} ${item.purpose ?? ''}`.toLowerCase();
      return text.includes(keyword);
    });
  }, [purchaseOptions, purchaseSearch]);

  return (
    <section className="space-y-4">
      <div className="surface-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Select value={scope} onValueChange={(value) => setScope(value as typeof scope)}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {scopeOptions.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="按单号/标题/分类搜索"
            className="w-[260px]"
          />
          <Button variant="outline" onClick={() => void fetchList()} disabled={loading}>
            刷新
          </Button>
          {canCreate && <Button onClick={openCreateDrawer}>发起报销</Button>}
        </div>
      </div>

      <div className="surface-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>报销单号</TableHead>
              <TableHead>标题</TableHead>
              <TableHead>来源</TableHead>
              <TableHead>关联采购单</TableHead>
              <TableHead>组织</TableHead>
              <TableHead>金额</TableHead>
              <TableHead>状态</TableHead>
              <TableHead>发生日期</TableHead>
              <TableHead className="text-right">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  加载中...
                </TableCell>
              </TableRow>
            ) : records.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground">
                  暂无报销记录
                </TableCell>
              </TableRow>
            ) : (
              records.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">{row.reimbursementNumber}</TableCell>
                  <TableCell>{row.title}</TableCell>
                  <TableCell>{SOURCE_LABELS[row.sourceType]}</TableCell>
                  <TableCell>{row.sourcePurchaseNumber ?? '-'}</TableCell>
                  <TableCell>{ORG_LABELS[row.organizationType]}</TableCell>
                  <TableCell>{MONEY.format(row.amount)}</TableCell>
                  <TableCell>
                    <span className={`rounded-full border px-2 py-0.5 text-xs ${STATUS_STYLES[row.status]}`}>
                      {STATUS_LABELS[row.status]}
                    </span>
                  </TableCell>
                  <TableCell>{toDateInputValue(row.occurredAt)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      {editable(row) && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => openEditDrawer(row)}>
                            编辑
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void handleDelete(row)}>
                            删除
                          </Button>
                        </>
                      )}
                      {isOwner(row) && (row.status === 'draft' || row.status === 'rejected') && (
                        <Button size="sm" variant="outline" onClick={() => void handleSubmit(row)}>
                          提交
                        </Button>
                      )}
                      {canApprove && row.status === 'pending_approval' && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => void handleApprove(row)}>
                            通过
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => void handleReject(row)}>
                            驳回
                          </Button>
                        </>
                      )}
                      {canOperatePay(row) && (
                        <Button size="sm" variant="outline" onClick={() => void handlePay(row)}>
                          标记打款
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Drawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) resetForm();
        }}
        direction="right"
      >
        <DrawerContent side="right" className="w-full max-w-3xl">
          <DrawerHeader>
            <DrawerTitle>{editingId ? '编辑报销草稿' : '发起报销'}</DrawerTitle>
          </DrawerHeader>
          <DrawerBody className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">报销来源</div>
                <Select
                  value={form.sourceType}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      sourceType: value as ReimbursementSourceType,
                      sourcePurchaseId: value === 'purchase' ? prev.sourcePurchaseId ?? '' : '',
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="direct">直接报销</SelectItem>
                    <SelectItem value="purchase">关联采购</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">组织</div>
                <Select
                  value={form.organizationType}
                  onValueChange={(value) =>
                    setForm((prev) => ({ ...prev, organizationType: value as ReimbursementOrganizationType }))
                  }
                  disabled={form.sourceType === 'purchase'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="school">学校</SelectItem>
                    <SelectItem value="company">单位</SelectItem>
                  </SelectContent>
                </Select>
                {form.sourceType === 'purchase' ? (
                  <p className="text-xs text-muted-foreground">关联采购时，组织自动跟随采购单。</p>
                ) : null}
              </div>
            </div>

            {form.sourceType === 'purchase' && (
              <div className="space-y-3 rounded-xl border border-border/60 p-3">
                <div className="space-y-2">
                  <div className="text-sm font-medium">筛选采购单</div>
                  <Input
                    value={purchaseSearch}
                    onChange={(event) => setPurchaseSearch(event.target.value)}
                    placeholder="按采购单号/物品关键字筛选"
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-sm font-medium">关联采购单</div>
                  <Select
                    value={form.sourcePurchaseId?.trim() || ''}
                    onValueChange={(value) => {
                      const picked = purchaseMap.get(value);
                      setForm((prev) => ({
                        ...prev,
                        sourcePurchaseId: value,
                        organizationType: (picked?.organizationType ?? prev.organizationType) as ReimbursementOrganizationType,
                        title: prev.title.trim() ? prev.title : `${picked?.itemName ?? '采购'}报销`,
                        amount: Number(prev.amount) > 0 ? prev.amount : Number(picked?.totalAmount ?? 0),
                      }));
                    }}
                    disabled={purchaseLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={purchaseLoading ? '加载采购单中...' : '请选择采购单'} />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredPurchases.map((item) => (
                        <SelectItem key={item.id} value={item.id}>
                          {item.purchaseNumber} · {item.itemName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {selectedPurchase ? (
                  <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-2 text-xs text-muted-foreground">
                    <p>采购单号：{selectedPurchase.purchaseNumber}</p>
                    <p>物品：{selectedPurchase.itemName}</p>
                    <p>金额：{MONEY.format(Number(selectedPurchase.totalAmount) + Number(selectedPurchase.feeAmount ?? 0))}</p>
                    <p>组织：{selectedPurchase.organizationType === 'school' ? '学校' : '单位'}</p>
                  </div>
                ) : null}

                {eligibilityChecking ? (
                  <p className="text-xs text-muted-foreground">正在校验关联采购单是否已入库...</p>
                ) : eligibility ? (
                  eligibility.eligible ? (
                    <p className="text-xs text-chart-5">该采购单已满足入库条件，可关联报销。</p>
                  ) : (
                    <p className="text-xs text-destructive">{eligibility.reason ?? '该采购单暂不可关联报销'}</p>
                  )
                ) : null}
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">报销分类</div>
                <Select
                  value={form.category}
                  onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {REIMBURSEMENT_CATEGORY_OPTIONS.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">发生日期</div>
                <Input
                  type="date"
                  value={form.occurredAt}
                  onChange={(event) => setForm((prev) => ({ ...prev, occurredAt: event.target.value }))}
                />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <div className="text-sm font-medium">标题</div>
                <Input
                  value={form.title}
                  onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                  placeholder="例如：打车报销（客户拜访）"
                />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium">金额</div>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={form.amount}
                  onChange={(event) => setForm((prev) => ({ ...prev, amount: Number(event.target.value) }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-sm font-medium">说明</div>
              <Textarea
                value={form.description ?? ''}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="可选说明"
                rows={3}
              />
            </div>

            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <div>
                <div className="text-sm font-medium">收款凭证</div>
                <p className="text-xs text-muted-foreground">提交前至少需要上传发票或收款凭证其中一项。</p>
              </div>
              <FileUpload
                files={form.receiptImages ?? []}
                onChange={(files) => setForm((prev) => ({ ...prev, receiptImages: files }))}
                maxFiles={8}
                folder="reimbursements/receipts"
                prefix="receipt"
                buttonLabel="上传收款凭证"
                helperText="支持 JPG/PNG/PDF，每个文件 ≤5MB"
                disabled={submitting}
              />
            </div>

            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <div className="text-sm font-medium">发票附件</div>
              <FileUpload
                files={form.invoiceImages ?? []}
                onChange={(files) => setForm((prev) => ({ ...prev, invoiceImages: files }))}
                maxFiles={8}
                folder="reimbursements/invoices"
                prefix="invoice"
                buttonLabel="上传发票"
                helperText="支持 JPG/PNG/PDF，每个文件 ≤5MB"
                disabled={submitting}
              />
            </div>

            <div className="space-y-3 rounded-xl border border-border/60 p-3">
              <div className="text-sm font-medium">其他附件</div>
              <FileUpload
                files={form.attachments ?? []}
                onChange={(files) => setForm((prev) => ({ ...prev, attachments: files }))}
                maxFiles={10}
                folder="reimbursements/attachments"
                prefix="attachment"
                buttonLabel="上传附件"
                helperText="可上传报销明细、行程单等材料"
                disabled={submitting}
              />
            </div>
          </DrawerBody>
          <DrawerFooter>
            <Button variant="outline" onClick={() => setDrawerOpen(false)} disabled={submitting}>
              取消
            </Button>
            <Button
              onClick={() => void submitForm()}
              disabled={
                submitting ||
                (form.sourceType === 'purchase' && eligibility != null && !eligibility.eligible)
              }
            >
              {submitting ? '提交中...' : editingId ? '保存修改' : '保存草稿'}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </section>
  );
}
