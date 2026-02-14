'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, RefreshCw, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { usePermissions } from '@/hooks/usePermissions';
import { useConfirm } from '@/hooks/useConfirm';
import type { InventoryItem, InventoryItemPayload, InventorySpecField } from '@/types/inventory';

/* ─── helpers ─── */
const fmt = new Intl.NumberFormat('zh-CN', { style: 'currency', currency: 'CNY', maximumFractionDigits: 2 });

function emptyPayload(): InventoryItemPayload {
  return { sku: '', name: '', unit: '', unitPrice: 0, category: '原材料', safetyStock: 0, specFields: [] };
}

function emptySpecField(): InventorySpecField {
  return { key: '', label: '', options: [], defaultValue: '' };
}

/* ─── Main Component ─── */
export default function InventoryItemsPage() {
  const { hasPermission, loading: permLoading } = usePermissions();
  const canManage = useMemo(() => hasPermission('INVENTORY_MANAGE_ITEMS'), [hasPermission]);
  const confirm = useConfirm();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [form, setForm] = useState<InventoryItemPayload>(emptyPayload());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/inventory/items');
      const json = await res.json();
      setItems(json.data ?? []);
    } catch {
      console.error('Failed to load items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const q = search.toLowerCase();
    return items.filter(
      (i) => i.name.toLowerCase().includes(q) || i.sku.toLowerCase().includes(q) || i.category.toLowerCase().includes(q)
    );
  }, [items, search]);

  /* ─── Dialog handlers ─── */
  const openCreate = () => {
    setEditingItem(null);
    setForm(emptyPayload());
    setError('');
    setDialogOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingItem(item);
    setForm({
      sku: item.sku,
      name: item.name,
      unit: item.unit,
      unitPrice: item.unitPrice,
      category: item.category,
      safetyStock: item.safetyStock,
      barcode: item.barcode,
      specFields: item.specFields ?? [],
    });
    setError('');
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setError('商品名称不能为空'); return; }
    if (!form.unit.trim()) { setError('计量单位不能为空'); return; }
    setSaving(true);
    setError('');
    try {
      const url = editingItem ? `/api/inventory/items/${editingItem.id}` : '/api/inventory/items';
      const method = editingItem ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok) { setError(json.error || '操作失败'); return; }
      setDialogOpen(false);
      fetchItems();
    } catch {
      setError('网络错误');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: InventoryItem) => {
    const ok = await confirm({
      title: '删除商品',
      description: `确定要删除「${item.name}」(${item.sku})？该操作不可撤销。`,
      confirmText: '删除',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/inventory/items/${item.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) { alert(json.error || '删除失败'); return; }
      fetchItems();
    } catch {
      alert('网络错误');
    }
  };

  /* ─── Spec fields editor ─── */
  const specFields = form.specFields ?? [];
  const updateSpecField = (idx: number, patch: Partial<InventorySpecField>) => {
    const next = [...specFields];
    next[idx] = { ...next[idx], ...patch };
    setForm((f) => ({ ...f, specFields: next }));
  };
  const addSpecField = () => {
    setForm((f) => ({ ...f, specFields: [...(f.specFields ?? []), emptySpecField()] }));
  };
  const removeSpecField = (idx: number) => {
    setForm((f) => ({ ...f, specFields: (f.specFields ?? []).filter((_, i) => i !== idx) }));
  };

  /* ─── Permission gate ─── */
  if (permLoading) {
    return <div className="p-6 text-sm text-muted-foreground">正在校验权限...</div>;
  }
  if (!canManage) {
    return (
      <div className="p-6">
        <div className="alert-box alert-danger">当前账户无权管理商品目录，请联系管理员。</div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-4 overflow-hidden">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-foreground">商品目录</h1>
          <p className="text-xs text-muted-foreground">管理库存商品的基本信息与规格参数</p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="搜索名称 / SKU / 分类..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 sm:w-64"
          />
          <Button variant="outline" size="sm" onClick={fetchItems} disabled={loading}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />刷新
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />新增商品
          </Button>
        </div>
      </div>

      {/* Table */}
      <div className="surface-card flex-1 min-h-0 overflow-hidden flex flex-col border border-border">
        <div className="max-h-[calc(100vh-280px)] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-border bg-muted text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">商品名称</th>
                <th className="px-4 py-3">SKU</th>
                <th className="px-4 py-3">分类</th>
                <th className="px-4 py-3">单位</th>
                <th className="px-4 py-3 text-right">单价</th>
                <th className="px-4 py-3 text-right">安全库存</th>
                <th className="px-4 py-3 text-right">当前库存</th>
                <th className="px-4 py-3">规格</th>
                <th className="px-4 py-3 text-center">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={9} className="px-4 py-3">
                      <div className="h-5 w-full animate-pulse rounded bg-muted" />
                    </td>
                  </tr>
                ))
              ) : filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground">
                    <Package className="mx-auto mb-2 h-8 w-8 opacity-30" />
                    {search ? '未找到匹配的商品' : '暂无商品，点击「新增商品」创建'}
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-muted/20">
                    <td className="px-4 py-3 font-medium text-foreground">{item.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{item.sku}</td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="text-[10px]">{item.category}</Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.unit}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{fmt.format(item.unitPrice)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.safetyStock}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={
                        (item.stockQuantity ?? 0) < item.safetyStock
                          ? 'text-destructive font-semibold'
                          : 'text-foreground'
                      }>
                        {item.stockQuantity ?? 0}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {item.specFields?.length ? (
                        <span className="text-xs text-muted-foreground">{item.specFields.length} 项</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(item)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(item)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>{editingItem ? '编辑商品' : '新增商品'}</DialogTitle>
            <DialogDescription>
              {editingItem ? `修改「${editingItem.name}」的信息` : '填写商品基本信息和规格参数'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-5 py-4 px-1">
            {error && <div className="rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">{error}</div>}

            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <div className="space-y-2">
                <Label>商品名称 *</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="例：电致发光丝" />
              </div>
              <div className="space-y-2">
                <Label>SKU</Label>
                <Input value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} placeholder="留空自动生成" />
              </div>
              <div className="space-y-2">
                <Label>分类</Label>
                <Input value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))} placeholder="原材料" />
              </div>
              <div className="space-y-2">
                <Label>单位 *</Label>
                <Input value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="米 / 升 / 个" />
              </div>
              <div className="space-y-2">
                <Label>单价 (¥)</Label>
                <Input type="number" min={0} step={0.01} value={form.unitPrice} onChange={(e) => setForm((f) => ({ ...f, unitPrice: Number(e.target.value) }))} />
              </div>
              <div className="space-y-2">
                <Label>安全库存</Label>
                <Input type="number" min={0} value={form.safetyStock} onChange={(e) => setForm((f) => ({ ...f, safetyStock: Number(e.target.value) }))} />
              </div>
              <div className="col-span-2 space-y-2">
                <Label>条码</Label>
                <Input value={form.barcode ?? ''} onChange={(e) => setForm((f) => ({ ...f, barcode: e.target.value }))} placeholder="可选" />
              </div>
            </div>

            {/* Spec Fields */}
            <div className="space-y-3 pt-4 border-t border-border">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">规格参数</Label>
                <Button type="button" variant="outline" size="sm" onClick={addSpecField} className="h-7 text-xs">
                  <Plus className="mr-1 h-3 w-3" />添加规格
                </Button>
              </div>
              {specFields.length === 0 && (
                <p className="text-xs text-muted-foreground">暂无规格参数，点击「添加规格」新增</p>
              )}
              {specFields.map((sf, idx) => (
                <div key={idx} className="rounded-lg border border-border bg-muted/20 p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">规格 #{idx + 1}</span>
                    <Button type="button" variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => removeSpecField(idx)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Input placeholder="字段 key" value={sf.key} onChange={(e) => updateSpecField(idx, { key: e.target.value })} className="h-8 text-xs" />
                    <Input placeholder="显示名称" value={sf.label} onChange={(e) => updateSpecField(idx, { label: e.target.value })} className="h-8 text-xs" />
                  </div>
                  <Input
                    placeholder="选项（逗号分隔），如：蓝,绿,红"
                    value={(sf.options ?? []).join(',')}
                    onChange={(e) => updateSpecField(idx, { options: e.target.value ? e.target.value.split(',').map((s) => s.trim()) : [] })}
                    className="h-8 text-xs"
                  />
                  <Input
                    placeholder="默认值"
                    value={sf.defaultValue ?? ''}
                    onChange={(e) => updateSpecField(idx, { defaultValue: e.target.value })}
                    className="h-8 text-xs"
                  />
                </div>
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>取消</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? '保存中...' : editingItem ? '保存修改' : '创建商品'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
