"use client";

import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';

import { SearchableEntitySelect, type SearchableEntityOption } from '@/components/common/SearchableEntitySelect';
import { Button } from '@/components/ui/button';
import InventoryItemFormDialog from '@/components/inventory/InventoryItemFormDialog';
import type { InventoryItem } from '@/types/inventory';

const PAGE_SIZE = 50;

type InventoryItemDetailResponse = {
  success: boolean;
  data?: InventoryItem;
  error?: string;
};

type InventoryItemSelectorProps = {
  value: string;
  onChange: (itemId: string, item?: InventoryItem | null) => void;
  disabled?: boolean;
  helperText?: string;
  placeholder?: string;
};

export default function InventoryItemSelector({
  value,
  onChange,
  disabled = false,
  helperText = '',
  placeholder = '选择库存商品',
}: InventoryItemSelectorProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false);

  const fetchItems = useCallback(async (keyword: string) => {
    const params = new URLSearchParams();
    params.set('page', '1');
    params.set('pageSize', String(PAGE_SIZE));
    if (keyword.trim()) params.set('search', keyword.trim());
    const response = await fetch(`/api/inventory/items?${params.toString()}`, { cache: 'no-store' });
    const payload = (await response.json()) as { data: InventoryItem[]; error?: string }; // Corrected type assertion
    if (!response.ok) {
      throw new Error(payload.error ?? '加载库存商品失败');
    }
    // API returns { data: InventoryItem[] }
    return payload.data ?? [];
  }, []);

  const resolveItem = useCallback(async (id: string) => {
    if (!id) return null;
    const response = await fetch(`/api/inventory/items/${id}`, { cache: 'no-store' });
    const payload = (await response.json()) as InventoryItemDetailResponse;
    if (!response.ok || !payload.success) {
      throw new Error(payload.error ?? '无法加载库存商品');
    }
    return payload.data ?? null;
  }, []);

  const mapOption = useCallback(
    (item: InventoryItem): SearchableEntityOption<InventoryItem> => ({
      id: item.id,
      label: `${item.name} (${item.sku})`,
      description: '', // Clear description
      data: item,
    }),
    []
  );

  return (
    <div className="relative">
      <InventoryItemFormDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSuccess={() => {
          // We can't easily auto-select the new item without refactoring SearchableEntitySelect to expose control.
          // For now, user will have to search for the new item. 
          // Actually, we could potentially pass a callback to SearchableEntitySelect if we refactored it,
          // but simply closing the dialog is a good first step.
          // Ideally: onChange(newItem.id, newItem) if we had the newItem here.
          // But Validation is easier: just let them search.
        }}
      />
      <SearchableEntitySelect<InventoryItem>
        value={value}
        onChange={(id, item) => onChange(id, item ?? undefined)}
        fetchEntities={fetchItems}
        mapOption={mapOption}
        resolveEntity={resolveItem}
        placeholder={placeholder}
        helperText={helperText}
        disabled={disabled}
        searchPlaceholder="输入名称或SKU搜索"
        emptyText="暂无库存商品"
        renderOption={({ option, isSelected }) => <ItemOption item={option.data} isSelected={isSelected} />}
        renderFooter={({ items, clear, value: currentValue }) => (
          <div className="border-t border-border px-3 py-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-2">
              <span>当前展示 {items.length} 条</span>
              <Button type="button" variant="ghost" size="sm" onClick={clear} disabled={!currentValue}>
                清除选择
              </Button>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-center gap-2"
              onClick={() => setIsCreateOpen(true)}
            >
              <Plus className="h-4 w-4" />
              新建库存商品
            </Button>
          </div>
        )}
      />
    </div>
  );
}

function ItemOption({ item, isSelected }: { item: InventoryItem; isSelected: boolean }) {
  return (
    <div className="flex w-full items-start gap-3">
      <span className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary">{isSelected && <Checkmark />}</span>
      <div className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{item.name}</span>
          <span className="text-xs text-muted-foreground">{item.sku}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground">
            {item.category}
          </span>
        </div>
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
