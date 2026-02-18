"use client";

import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';

import { SearchableEntitySelect, type SearchableEntityOption } from '@/components/common/SearchableEntitySelect';
import { Button } from '@/components/ui/button';
import { formatInventoryItemName } from '@/lib/format';
import { getInventoryCategoryLabel, normalizeInventoryCategory } from '@/lib/inventory/catalog';
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
  placeholder = '选择物品',
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
    const items = payload.data ?? [];
    const normalizedKeyword = keyword.trim().toLowerCase();
    if (!normalizedKeyword) return items;
    return items.filter((item) => {
      const name = item.name?.toLowerCase() ?? '';
      const sku = item.sku?.toLowerCase() ?? '';
      const category = normalizeInventoryCategory(item.category).toLowerCase();
      return (
        name.includes(normalizedKeyword) ||
        sku.includes(normalizedKeyword) ||
        category.includes(normalizedKeyword)
      );
    });
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
      label: formatInventoryItemName(item.name),
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
        onSuccess={(newItem) => {
          onChange(newItem.id, newItem);
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
        emptyText="暂无可选物品，可点击下方“新增物品”"
        
        groupBy={(option) => getInventoryCategoryLabel(option.data.category)}
        renderGroupHeader={({ groupKey, count }) => (
          <div className="sticky top-0 z-10 -mx-1 -mt-1 mb-1 bg-muted/95 px-3 py-1.5 text-xs font-medium text-foreground/80 backdrop-blur supports-[backdrop-filter]:bg-muted/75">
            {groupKey} <span className="ml-1 text-[10px] text-muted-foreground font-normal">({count})</span>
          </div>
        )}
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
              新增物品
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
      <div className="mt-1 h-3 w-3 flex-shrink-0 rounded-full border border-primary/30 bg-primary/10">
        {isSelected && <div className="h-full w-full rounded-full bg-primary" />}
      </div>
      <div className="flex flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{formatInventoryItemName(item.name)}</span>
        </div>
      </div>
    </div>
  );
}

