import { useEffect, useState } from 'react';

import type { InventoryItem, Warehouse } from '@/types/inventory';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

type ReserveMode = 'reserve' | 'release';

type InventoryReserveDialogProps = {
  open: boolean;
  mode: ReserveMode;
  item: InventoryItem | null;
  warehouses: Warehouse[];
  submitting?: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (payload: { warehouseId: string; quantity: number }) => void | Promise<void>;
};

export default function InventoryReserveDialog({
  open,
  mode,
  item,
  warehouses,
  submitting,
  onOpenChange,
  onSubmit,
}: InventoryReserveDialogProps) {
  const [warehouseId, setWarehouseId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setWarehouseId('');
    setQuantity('1');
    setError(null);
  }, [open, mode, item?.id]);

  const handleSubmit = () => {
    if (!item) return;
    if (!warehouseId) {
      setError('请选择仓库');
      return;
    }
    const value = Number(quantity);
    if (!Number.isFinite(value) || value <= 0) {
      setError('数量需要大于 0');
      return;
    }
    setError(null);
    onSubmit({ warehouseId, quantity: value });
  };

  const title = mode === 'reserve' ? '预留库存' : '释放预留';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[92vw] max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <DialogBody>
          <div className="space-y-4">
            <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
              {item ? `${item.name}（${item.sku}）` : '请选择商品'}
            </div>
            <div className="space-y-2">
              <Label htmlFor="reserve-warehouse">仓库</Label>
              <Select value={warehouseId || undefined} onValueChange={setWarehouseId} disabled={submitting}>
                <SelectTrigger id="reserve-warehouse" className="w-full">
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
              <Label htmlFor="reserve-quantity">数量</Label>
              <Input
                id="reserve-quantity"
                type="number"
                min={1}
                value={quantity}
                onChange={(event) => setQuantity(event.target.value)}
                disabled={submitting}
              />
            </div>
            {error && <p className="text-xs text-rose-500">{error}</p>}
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            取消
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            {mode === 'reserve' ? '确认预留' : '确认释放'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
