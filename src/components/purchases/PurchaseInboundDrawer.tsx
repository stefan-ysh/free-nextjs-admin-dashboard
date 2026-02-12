import { useEffect, useMemo, useState } from 'react';

import type { InventoryItem, Warehouse } from '@/types/inventory';
import type { PurchaseRecord, PurchaseDetail } from '@/types/purchase';
import { Button } from '@/components/ui/button';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { FORM_DRAWER_WIDTH_COMPACT } from '@/components/common/form-drawer-width';

type PurchaseInboundDrawerProps = {
  open: boolean;
  purchase: PurchaseRecord | PurchaseDetail | null;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
};

type InboundFormState = {
  itemId: string;
  warehouseId: string;
  quantity: number;
  unitCost: number | '';
  notes: string;
};

const buildDefaultNotes = (purchase: PurchaseRecord) =>
  `采购单号：${purchase.purchaseNumber}；物品：${purchase.itemName}`;

export default function PurchaseInboundDrawer({
  open,
  purchase,
  onOpenChange,
  onSuccess,
}: PurchaseInboundDrawerProps) {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<InboundFormState>({
    itemId: '',
    warehouseId: '',
    quantity: 1,
    unitCost: '',
    notes: '',
  });

  useEffect(() => {
    if (!open || !purchase) return;
    setForm({
      itemId: '',
      warehouseId: '',
      quantity: Number(purchase.quantity ?? 1),
      unitCost: Number.isFinite(purchase.unitPrice) ? purchase.unitPrice : '',
      notes: buildDefaultNotes(purchase),
    });
    setError(null);
  }, [open, purchase]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    Promise.all([
      fetch('/api/inventory/items').then((res) => res.json()),
      fetch('/api/inventory/warehouses').then((res) => res.json()),
    ])
      .then(([itemsResponse, warehousesResponse]) => {
        setItems(itemsResponse.data ?? []);
        setWarehouses(warehousesResponse.data ?? []);
      })
      .catch((err) => {
        console.error('Failed to load inventory data', err);
        setError('加载库存数据失败');
      })
      .finally(() => setLoading(false));
  }, [open]);

  const matchedItem = useMemo(() => {
    if (!purchase || !items.length) return null;
    const matched = items.find((item) => item.name === purchase.itemName);
    return matched ?? null;
  }, [items, purchase]);

  useEffect(() => {
    if (!matchedItem) return;
    setForm((prev) => (prev.itemId ? prev : { ...prev, itemId: matchedItem.id }));
  }, [matchedItem]);

  const handleChange = <K extends keyof InboundFormState>(key: K, value: InboundFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async () => {
    if (!purchase) return;
    if (!form.itemId || !form.warehouseId) {
      setError('请选择商品与仓库');
      return;
    }
    if (!Number.isFinite(Number(form.quantity)) || Number(form.quantity) <= 0) {
      setError('数量需要大于 0');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const payload = {
        itemId: form.itemId,
        warehouseId: form.warehouseId,
        quantity: Number(form.quantity),
        type: 'purchase',
        unitCost: form.unitCost === '' ? undefined : Number(form.unitCost),
        notes: form.notes?.trim() || undefined,
      };
      const response = await fetch('/api/inventory/inbound', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error ?? '入库失败');
      }
      onOpenChange(false);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : '入库失败');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange} direction="right">
      <DrawerContent side="right" className={FORM_DRAWER_WIDTH_COMPACT}>
        <DrawerHeader>
          <DrawerTitle>采购到货入库</DrawerTitle>
          <DrawerDescription>选择商品与仓库后生成采购入库单。</DrawerDescription>
        </DrawerHeader>
        <DrawerBody>
          {loading ? (
            <div className="py-6 text-sm text-muted-foreground">正在加载库存数据...</div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {purchase ? `${purchase.itemName}（${purchase.purchaseNumber}）` : '未选择采购'}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>商品</Label>
                  <Select value={form.itemId || undefined} onValueChange={(value) => handleChange('itemId', value)}>
                    <SelectTrigger className="w-full">
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
                <div className="space-y-2">
                  <Label>仓库</Label>
                  <Select value={form.warehouseId || undefined} onValueChange={(value) => handleChange('warehouseId', value)}>
                    <SelectTrigger className="w-full">
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
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>数量</Label>
                  <Input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(event) => handleChange('quantity', Number(event.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>单价 (¥)</Label>
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    value={form.unitCost}
                    onChange={(event) =>
                      handleChange('unitCost', event.target.value ? Number(event.target.value) : '')
                    }
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>备注</Label>
                <Textarea
                  rows={3}
                  value={form.notes}
                  onChange={(event) => handleChange('notes', event.target.value)}
                />
              </div>
              {error ? <p className="text-xs text-destructive">{error}</p> : null}
            </div>
          )}
        </DrawerBody>
        <DrawerFooter>
          <DrawerClose asChild>
            <Button variant="outline" disabled={submitting}>
              取消
            </Button>
          </DrawerClose>
          <Button onClick={handleSubmit} disabled={submitting || loading}>
            {submitting ? '入库中...' : '确认入库'}
          </Button>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}
