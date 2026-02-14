'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import InventoryItemSelector from '@/components/common/InventoryItemSelector';
import { InventoryItem, Warehouse } from '@/types/inventory';
import { formatCurrency } from '@/lib/format';

type ApplicationItemRow = {
  key: string;
  item: InventoryItem | null;
  quantity: number;
};

export default function NewApplicationPage() {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  
  const [formData, setFormData] = useState({
    reason: '',
    warehouseId: '',
    type: 'use' as const,
  });

  const [rows, setRows] = useState<ApplicationItemRow[]>([
    { key: '1', item: null, quantity: 1 }
  ]);

  useEffect(() => {
    fetch('/api/inventory/warehouses')
      .then(res => res.json())
      .then(res => {
         // Filter out 'virtual' types if needed, or show all
         setWarehouses(res.data || []);
         // Default to first 'main' warehouse
         const main = (res.data || []).find((w: Warehouse) => w.type === 'main');
         if (main) setFormData(prev => ({ ...prev, warehouseId: main.id }));
      })
      .catch(console.error);
  }, []);

  const handleAddItem = () => {
    setRows(prev => [
      ...prev,
      { key: Math.random().toString(36).substr(2, 9), item: null, quantity: 1 }
    ]);
  };

  const handleRemoveItem = (index: number) => {
    if (rows.length <= 1) return;
    setRows(prev => prev.filter((_, i) => i !== index));
  };

  const handleItemChange = (index: number, item: InventoryItem | null) => {
    setRows(prev => {
      const next = [...prev];
      next[index].item = item;
      return next;
    });
  };

  const handleQuantityChange = (index: number, q: number) => {
    setRows(prev => {
      const next = [...prev];
      next[index].quantity = q;
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.warehouseId) return toast.error('请选择出库仓库');
    if (!formData.reason.trim()) return toast.error('请填写申请事由');
    
    // Validate items
    const validItems = rows.filter(r => r.item && r.quantity > 0);
    if (validItems.length === 0) return toast.error('请至少选择一项物品');
    
    setSubmitting(true);
    try {
      const warehouse = warehouses.find(w => w.id === formData.warehouseId);
      const payload = {
        applicantName: 'Current User', // Backend will override
        type: formData.type,
        reason: formData.reason,
        warehouseId: formData.warehouseId,
        warehouseName: warehouse?.name || 'Unknown',
        items: validItems.map(row => ({
          itemId: row.item!.id,
          quantity: row.quantity
        }))
      };

      const res = await fetch('/api/inventory/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        throw new Error('提交失败');
      }
      
      toast.success('申请提交成功');
      router.push('/inventory/applications');
    } catch (error) {
      toast.error('提交失败，请重试');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="text-2xl font-bold tracking-tight">发起领用申请</h2>
          <p className="text-muted-foreground">申请领用实验耗材或办公用品</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="surface-card space-y-8 p-6">
        <div className="grid gap-6 md:grid-cols-2">
           <div className="space-y-2">
            <Label>仓库</Label>
            <Select 
              value={formData.warehouseId} 
              onValueChange={v => setFormData(prev => ({ ...prev, warehouseId: v }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="选择仓库" />
              </SelectTrigger>
              <SelectContent>
                {warehouses.map(w => (
                  <SelectItem key={w.id} value={w.id}>{w.name} ({w.type === 'main' ? '主仓' : '分仓'})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>申请类型</Label>
            <Select 
              value={formData.type} 
              onValueChange={v => setFormData(prev => ({ ...prev, type: v as any }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="use">自用</SelectItem>
                <SelectItem value="transfer">调拨</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label>申请事由 <span className="text-destructive">*</span></Label>
            <Textarea 
              value={formData.reason}
              onChange={e => setFormData(prev => ({ ...prev, reason: e.target.value }))}
              placeholder="请说明用途，例如：项目X实验需要..."
              required 
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between border-b pb-2">
            <Label className="text-base font-semibold">物品明细</Label>
            <Button type="button" variant="outline" size="sm" onClick={handleAddItem}>
              <Plus className="mr-2 h-4 w-4" /> 添加物品
            </Button>
          </div>

          <div className="space-y-4">
             {rows.map((row, index) => (
               <div key={row.key} className="flex gap-4 items-start rounded-lg border p-4 bg-muted/30">
                 <div className="flex-1 space-y-2">
                   <Label className="text-xs text-muted-foreground">选择物品</Label>
                   <InventoryItemSelector 
                     value={row.item?.id ?? ''}
                     onChange={(_id, item) => handleItemChange(index, item || null)}
                   />
                   {row.item && (
                     <div className="text-xs text-muted-foreground mt-1">
                       库存: {row.item.stockQuantity ?? 0} {row.item.unit} | 单价: {formatCurrency(row.item.unitPrice)}
                     </div>
                   )}
                 </div>
                 
                 <div className="w-32 space-y-2">
                   <Label className="text-xs text-muted-foreground">数量</Label>
                   <Input 
                      type="number" 
                      min={0.01} 
                      step={0.01}
                      value={row.quantity}
                      onChange={e => handleQuantityChange(index, Number(e.target.value))}
                   />
                 </div>

                 <div className="pt-8">
                   <Button 
                     type="button" 
                     variant="ghost" 
                     size="icon" 
                     className="text-muted-foreground hover:text-destructive"
                     onClick={() => handleRemoveItem(index)}
                     disabled={rows.length === 1}
                   >
                     <Trash2 className="h-4 w-4" />
                   </Button>
                 </div>
               </div>
             ))}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button type="button" variant="ghost" onClick={() => router.back()} className="mr-4">
            取消
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting ? '提交中...' : '提交申请'}
          </Button>
        </div>
      </form>
    </div>
  );
}
