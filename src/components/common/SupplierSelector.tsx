"use client";

import { useCallback } from 'react';

import { SearchableEntitySelect, type SearchableEntityOption } from '@/components/common/SearchableEntitySelect';
import { Button } from '@/components/ui/button';
import type { Supplier, SupplierStatus } from '@/types/supplier';

const STATUS_LABELS: Record<SupplierStatus, string> = {
  active: '正常合作',
  inactive: '暂停',
  blacklisted: '黑名单',
};

const STATUS_BADGE_CLASS: Record<SupplierStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-100',
  inactive: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-100',
  blacklisted: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-100',
};

const PAGE_SIZE = 50;

type SupplierListResponse = {
  success: boolean;
  data?: {
    items: Supplier[];
    total: number;
    page: number;
    pageSize: number;
  };
  error?: string;
};

type SupplierDetailResponse = {
  success: boolean;
  data?: Supplier;
  error?: string;
};

type SupplierSelectorProps = {
  value: string;
  onChange: (supplierId: string, supplier?: Supplier | null) => void;
  disabled?: boolean;
  helperText?: string;
  status?: SupplierStatus | 'all';
  placeholder?: string;
};

export default function SupplierSelector({
  value,
  onChange,
  disabled = false,
  helperText = '仅展示状态为正常的供应商，可搜索中文/简称快速过滤',
  status = 'active',
  placeholder = '选择供应商',
}: SupplierSelectorProps) {
  const fetchSuppliers = useCallback(async (keyword: string) => {
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', String(PAGE_SIZE));
    if (keyword.trim()) params.set('search', keyword.trim());
    if (status && status !== 'all') params.set('status', status);
    const response = await fetch(`/api/suppliers?${params.toString()}`, { cache: 'no-store' });
    const payload = (await response.json()) as SupplierListResponse;
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error ?? '加载供应商失败');
    }
    return payload.data.items ?? [];
  }, [status]);

  const resolveSupplier = useCallback(async (id: string) => {
    if (!id) return null;
    const response = await fetch(`/api/suppliers/${id}`, { cache: 'no-store' });
    const payload = (await response.json()) as SupplierDetailResponse;
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? '无法加载供应商');
    }
    return payload.data ?? null;
  }, []);

  const mapOption = useCallback(
    (supplier: Supplier): SearchableEntityOption<Supplier> => ({
      id: supplier.id,
      label: supplier.name,
      description: supplier.shortName ?? undefined,
      data: supplier,
    }),
    []
  );

  return (
    <SearchableEntitySelect<Supplier>
      value={value}
      onChange={(id, supplier) => onChange(id, supplier ?? undefined)}
      fetchEntities={fetchSuppliers}
      mapOption={mapOption}
      resolveEntity={resolveSupplier}
      placeholder={placeholder}
      helperText={helperText}
      disabled={disabled}
      searchPlaceholder="输入名称或简称"
      emptyText="暂无可用供应商，或您没有访问权限"
      renderOption={({ option, isSelected }) => <SupplierOption supplier={option.data} isSelected={isSelected} />}
      renderSummary={(supplier) => <SupplierSummary supplier={supplier} />}
      renderFooter={({ items, clear, value: currentValue }) => (
        <div className="flex items-center justify-between border-t border-border px-3 py-2 text-xs text-muted-foreground">
          <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!currentValue}>
            清除选择
          </Button>
          <span>当前展示 {items.length} 条（最多 {PAGE_SIZE} 条）</span>
        </div>
      )}
    />
  );
}

function SupplierOption({ supplier, isSelected }: { supplier: Supplier; isSelected: boolean }) {
  return (
    <div className="flex w-full items-start gap-3">
      <span className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-500">{isSelected && <Checkmark />}</span>
      <div className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-gray-900 dark:text-gray-100">{supplier.name}</span>
          {supplier.shortName && <span className="text-xs text-gray-500 dark:text-gray-400">{supplier.shortName}</span>}
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STATUS_BADGE_CLASS[supplier.status]}`}>
            {STATUS_LABELS[supplier.status]}
          </span>
        </div>
        <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
          {supplier.category && <span>分类：{supplier.category}</span>}
          {supplier.tags?.length ? <span>标签：{supplier.tags.slice(0, 2).join(' / ')}</span> : null}
          <span>信用额度：¥{Number(supplier.creditLimit || 0).toLocaleString('zh-CN')}</span>
        </div>
      </div>
    </div>
  );
}

function SupplierSummary({ supplier }: { supplier: Supplier }) {
  return (
    <div className="text-blue-900 dark:text-blue-100">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-semibold">{supplier.name}</div>
        {supplier.shortName && <div className="text-xs">简称：{supplier.shortName}</div>}
      </div>
      <div className="mt-2 space-y-1 text-xs">
        {supplier.category && <p>分类：{supplier.category}</p>}
        {supplier.email && <p>邮箱：{supplier.email}</p>}
        {supplier.phone && <p>电话：{supplier.phone}</p>}
        {supplier.paymentTerm && <p>付款条件：{supplier.paymentTerm}</p>}
      </div>
    </div>
  );
}

function Checkmark() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-7.25 7.25a1 1 0 01-1.414 0l-3.25-3.25a1 1 0 011.414-1.414L8.5 11.586l6.543-6.543a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}
