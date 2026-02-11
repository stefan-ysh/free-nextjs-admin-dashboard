'use client';

import { useEffect, useMemo, useState } from 'react';

import type {
  InventoryInboundPayload,
  InventoryItem,
  Warehouse,
} from '@/types/inventory';
import { usePermissions } from '@/hooks/usePermissions';
import { specFieldsToDefaultRecord } from '@/lib/inventory/spec';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

const defaultPayload: InventoryInboundPayload = {
  itemId: '',
  warehouseId: '',
  quantity: 1,
  type: 'purchase',
};

export default function InventoryInboundPage() {
  const { hasPermission, loading: permissionLoading } = usePermissions();
  const canOperate = useMemo(
    () => hasPermission('INVENTORY_OPERATE_INBOUND'),
    [hasPermission]
  );

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [payload, setPayload] = useState<InventoryInboundPayload>(defaultPayload);
  const [submitting, setSubmitting] = useState(false);

  const selectedItem = useMemo(
    () => items.find((item) => item.id === payload.itemId),
    [items, payload.itemId]
  );

  useEffect(() => {
    if (!canOperate) return;
    Promise.all([
      fetch('/api/inventory/items').then((res) => res.json()),
      fetch('/api/inventory/warehouses').then((res) => res.json()),
    ])
      .then(([itemsResponse, warehousesResponse]) => {
        setItems(itemsResponse.data ?? []);
        setWarehouses(warehousesResponse.data ?? []);
      })
      .catch((error) => console.error('Failed to load dependency data', error));
  }, [canOperate]);

  const handleChange = (
    field: keyof InventoryInboundPayload,
    value: InventoryInboundPayload[keyof InventoryInboundPayload]
  ) => {
    setPayload((prev) => ({ ...prev, [field]: value }));
  };

  const handleSpecChange = (key: string, value: string) => {
    setPayload((prev) => ({
      ...prev,
      attributes: {
        ...(prev.attributes ?? {}),
        [key]: value,
      },
    }));
  };

  useEffect(() => {
    if (!selectedItem) {
      return;
    }
    const defaultAttributes = specFieldsToDefaultRecord(selectedItem.specFields);
    setPayload((prev) => ({
      ...prev,
      unitCost: prev.unitCost ?? selectedItem.unitPrice,
      attributes: prev.attributes ?? defaultAttributes ?? {},
    }));
  }, [selectedItem]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canOperate || !payload.itemId || !payload.warehouseId) {
      toast.error('请选择商品与仓库');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/inventory/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const error = await res.json();
        toast.error(error.error ?? '创建失败');
      } else {
        toast.success('入库单创建成功');
        setPayload({ ...defaultPayload });
      }
    } catch (error) {
      console.error('Failed to create inbound record', error);
      toast.error('创建失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };

  if (permissionLoading) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-gray-200 bg-white p-6 text-sm text-gray-600 shadow dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300">
          正在校验权限...
        </div>
      </div>
    );
  }

  if (!canOperate) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl border border-rose-200 bg-white p-6 text-sm text-rose-600 shadow dark:border-rose-500/40 dark:bg-gray-900 dark:text-rose-300">
          当前账户无权创建入库单。
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="surface-card space-y-6 p-6"
      >
        <div className="space-y-2">
          <Label htmlFor="inbound-item" className="text-sm font-medium text-gray-700 dark:text-gray-200">
            商品
          </Label>
          <Select
            value={payload.itemId || undefined}
            onValueChange={(value) => handleChange('itemId', value)}
            disabled={submitting}
          >
            <SelectTrigger id="inbound-item" className="w-full">
              <SelectValue placeholder="选择商品" />
            </SelectTrigger>
            <SelectContent>
              {items.map((item) => (
                <SelectItem key={item.id} value={item.id}>
                  {item.name}（{item.sku}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {selectedItem && (
          <div className="rounded-xl border border-dashed border-brand-200 bg-brand-50/40 p-4 text-sm text-brand-700 dark:border-brand-500/40 dark:bg-brand-500/10 dark:text-brand-100">
            标准单价：¥{selectedItem.unitPrice.toLocaleString()} / {selectedItem.unit}
          </div>
        )}

        {selectedItem?.specFields?.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {selectedItem.specFields.map((field) => {
              const specValue = payload.attributes?.[field.key] ?? '';
              return (
                <div key={field.key} className="space-y-2">
                  <Label className="text-sm font-medium text-gray-700 dark:text-gray-200">{field.label}</Label>
                  {field.options ? (
                    <Select
                      value={specValue || undefined}
                      onValueChange={(value) => handleSpecChange(field.key, value)}
                      disabled={submitting}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder={`选择${field.label}`} />
                      </SelectTrigger>
                      <SelectContent>
                        {field.options.map((option) => (
                          <SelectItem key={option} value={option}>
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      value={specValue}
                      onChange={(event) => handleSpecChange(field.key, event.target.value)}
                      placeholder={`填写${field.label}`}
                      disabled={submitting}
                    />
                  )}
                </div>
              );
            })}
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="inbound-warehouse" className="text-sm font-medium text-gray-700 dark:text-gray-200">
              仓库
            </Label>
            <Select
              value={payload.warehouseId || undefined}
              onValueChange={(value) => handleChange('warehouseId', value)}
              disabled={submitting}
            >
              <SelectTrigger id="inbound-warehouse" className="w-full">
                <SelectValue placeholder="选择仓库" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map((warehouse) => (
                  <SelectItem key={warehouse.id} value={warehouse.id}>
                    {warehouse.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inbound-type" className="text-sm font-medium text-gray-700 dark:text-gray-200">
              入库类型
            </Label>
            <Select
              value={payload.type}
              onValueChange={(value) => handleChange('type', value as InventoryInboundPayload['type'])}
              disabled={submitting}
            >
              <SelectTrigger id="inbound-type" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="purchase">采购入库</SelectItem>
                <SelectItem value="transfer">调拨入库</SelectItem>
                <SelectItem value="adjust">盘盈调整</SelectItem>
                <SelectItem value="return">退货入库</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="inbound-quantity" className="text-sm font-medium text-gray-700 dark:text-gray-200">
              数量
            </Label>
            <Input
              id="inbound-quantity"
              type="number"
              min={1}
              value={payload.quantity}
              onChange={(event) => handleChange('quantity', Number(event.target.value))}
              required
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="inbound-unit-cost" className="text-sm font-medium text-gray-700 dark:text-gray-200">
              单价 (¥)
            </Label>
            <Input
              id="inbound-unit-cost"
              type="number"
              min={0}
              step="0.01"
              value={payload.unitCost ?? ''}
              onChange={(event) =>
                handleChange('unitCost', event.target.value ? Number(event.target.value) : undefined)
              }
              disabled={submitting}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="inbound-notes" className="text-sm font-medium text-gray-700 dark:text-gray-200">
            备注
          </Label>
          <Textarea
            id="inbound-notes"
            value={payload.notes ?? ''}
            onChange={(event) => handleChange('notes', event.target.value)}
            rows={3}
            placeholder="可填写采购单号、批次等信息"
            disabled={submitting}
          />
        </div>

        <Button type="submit" disabled={submitting} className="w-full" size="lg">
          {submitting ? '提交中...' : '创建入库单'}
        </Button>
      </form>
    </div>
  );
}
