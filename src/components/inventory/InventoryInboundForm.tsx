'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type {
    InventoryInboundPayload,
    InventoryItem,
    Warehouse,
} from '@/types/inventory';
import type { PurchaseRecord } from '@/types/purchase';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const defaultPayload: InventoryInboundPayload = {
    itemId: '',
    warehouseId: '',
    quantity: 1,
    type: 'purchase',
};
const MIN_INBOUND_QUANTITY = 0.001;

interface InventoryInboundFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
    formId?: string;
    hideActions?: boolean;
    initialRelatedPurchaseId?: string;
}

function findWarehouseIdByOrgType(warehouses: Warehouse[], orgType?: PurchaseRecord['organizationType']): string | undefined {
    const targetCode = orgType === 'school' ? 'SCHOOL' : orgType === 'company' ? 'COMPANY' : undefined;
    if (!targetCode) return undefined;
    const matched = warehouses.find((warehouse) => warehouse.code.toUpperCase() === targetCode);
    return matched?.id;
}

export default function InventoryInboundForm({
    onSuccess,
    onCancel,
    formId,
    hideActions = false,
    initialRelatedPurchaseId,
}: InventoryInboundFormProps) {
    const { hasPermission, loading: permissionLoading } = usePermissions();
    const canOperate = useMemo(
        () =>
            hasPermission('INVENTORY_OPERATE_INBOUND') ||
            hasPermission('INVENTORY_INBOUND_CREATE_OWN_PURCHASE_ONLY'),
        [hasPermission]
    );

    const [items, setItems] = useState<InventoryItem[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [purchases, setPurchases] = useState<PurchaseRecord[]>([]);
    const [payload, setPayload] = useState<InventoryInboundPayload>(defaultPayload);
    const [submitting, setSubmitting] = useState(false);

    const selectedPurchase = useMemo(
        () => purchases.find((purchase) => purchase.id === payload.relatedPurchaseId),
        [payload.relatedPurchaseId, purchases]
    );
    const selectedItem = useMemo(() => {
        if (!selectedPurchase) return null;
        if (selectedPurchase.inventoryItemId) {
            return items.find((item) => item.id === selectedPurchase.inventoryItemId) ?? null;
        }
        return items.find((item) => item.name === selectedPurchase.itemName) ?? null;
    }, [items, selectedPurchase]);
    const selectedWarehouseId = useMemo(
        () => (selectedPurchase ? findWarehouseIdByOrgType(warehouses, selectedPurchase.organizationType) : undefined),
        [selectedPurchase, warehouses]
    );
    const selectedWarehouse = useMemo(
        () => warehouses.find((warehouse) => warehouse.id === payload.warehouseId) ?? null,
        [payload.warehouseId, warehouses]
    );
    const remainingQuantity = useMemo(() => {
        if (!selectedPurchase) return 0;
        return Math.max(0, Number(selectedPurchase.quantity ?? 0) - Number(selectedPurchase.inboundQuantity ?? 0));
    }, [selectedPurchase]);
    const [initialSelectionHandled, setInitialSelectionHandled] = useState(false);

    useEffect(() => {
        if (!canOperate) return;
        Promise.all([
            fetch('/api/inventory/items').then((res) => res.json()),
            fetch('/api/inventory/warehouses').then((res) => res.json()),
            fetch('/api/purchases?page=1&pageSize=100&sortBy=updatedAt&sortOrder=desc').then((res) => res.json()),
        ])
            .then(([itemsResponse, warehousesResponse, purchasesResponse]) => {
                setItems(itemsResponse.data ?? []);
                setWarehouses(warehousesResponse.data ?? []);
                const rows = (purchasesResponse?.data?.items ?? []) as PurchaseRecord[];
                setPurchases(
                    rows.filter(
                        (row) =>
                            (row.status === 'pending_inbound' ||
                                row.status === 'approved' ||
                                row.status === 'paid') &&
                            Math.max(0, Number(row.quantity ?? 0) - Number(row.inboundQuantity ?? 0)) > 0
                    )
                );
            })
            .catch((error) => console.error('Failed to load dependency data', error));
    }, [canOperate]);

    useEffect(() => {
        if (initialSelectionHandled) return;
        const targetId = initialRelatedPurchaseId?.trim();
        if (!targetId) {
            setInitialSelectionHandled(true);
            return;
        }
        if (purchases.length === 0) return;

        const matched = purchases.find((purchase) => purchase.id === targetId);
        if (!matched) {
            toast.error('指定采购单当前不可入库（可能已完成入库或状态不允许）');
            setInitialSelectionHandled(true);
            return;
        }
        setPayload((prev) => ({
            ...prev,
            type: 'purchase',
            relatedPurchaseId: matched.id,
        }));
        setInitialSelectionHandled(true);
    }, [initialRelatedPurchaseId, initialSelectionHandled, purchases]);

    const handleChange = (
        field: keyof InventoryInboundPayload,
        value: InventoryInboundPayload[keyof InventoryInboundPayload]
    ) => {
        setPayload((prev) => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        if (!selectedPurchase) return;
        setPayload((prev) => {
            const nextItemId = selectedItem?.id ?? prev.itemId;
            const nextWarehouseId = selectedWarehouseId ?? prev.warehouseId;
            const maxInbound = Math.max(
                0,
                Number(selectedPurchase.quantity ?? 0) - Number(selectedPurchase.inboundQuantity ?? 0)
            );
            const nextQuantity =
                maxInbound > 0
                    ? Math.min(Math.max(MIN_INBOUND_QUANTITY, Number(prev.quantity) || MIN_INBOUND_QUANTITY), maxInbound)
                    : MIN_INBOUND_QUANTITY;

            if (
                prev.itemId === nextItemId &&
                prev.warehouseId === nextWarehouseId &&
                prev.quantity === nextQuantity
            ) {
                return prev;
            }

            return {
                ...prev,
                type: 'purchase',
                relatedPurchaseId: selectedPurchase.id,
                itemId: nextItemId,
                warehouseId: nextWarehouseId,
                quantity: nextQuantity,
            };
        });
    }, [selectedItem, selectedPurchase, selectedWarehouseId]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const purchaseId = payload.relatedPurchaseId?.trim();
        if (!purchaseId) {
            toast.error('请先选择关联采购单');
            return;
        }
        if (!canOperate || !payload.itemId || !payload.warehouseId) {
            toast.error('请选择商品与仓库');
            return;
        }
        if (remainingQuantity <= 0) {
            toast.error('该采购单已完成入库');
            return;
        }
        if (!Number.isFinite(Number(payload.quantity)) || Number(payload.quantity) <= 0) {
            toast.error('入库数量需大于 0');
            return;
        }
        if (Number(payload.quantity) > remainingQuantity) {
            toast.error(`本次最多可入库 ${remainingQuantity} 件`);
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch('/api/inventory/inbound', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...payload,
                    type: 'purchase',
                    relatedPurchaseId: purchaseId,
                }),
            });
            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error ?? '创建失败');
            } else {
                toast.success('入库单创建成功');
                setPayload({ ...defaultPayload });
                onSuccess?.();
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
            <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
                正在校验权限...
            </div>
        );
    }

    if (!canOperate) {
        return (
            <div className="alert-box alert-danger">
                当前账户无权创建入库单。
            </div>
        );
    }

    return (
        <form id={formId} onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
                <Label htmlFor="inbound-related-purchase" className="text-sm font-medium">
                    关联采购单
                </Label>
                <Select
                    value={payload.relatedPurchaseId || undefined}
                    onValueChange={(value) =>
                        setPayload((prev) => ({
                            ...prev,
                            type: 'purchase',
                            relatedPurchaseId: value,
                        }))
                    }
                    disabled={submitting}
                >
                    <SelectTrigger id="inbound-related-purchase" className="w-full">
                        <SelectValue placeholder="选择采购单" />
                    </SelectTrigger>
                    <SelectContent>
                        {purchases.map((purchase) => (
                            <SelectItem key={purchase.id} value={purchase.id}>
                                {purchase.purchaseNumber} · {purchase.itemName}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {selectedPurchase ? (
                <div className="rounded-lg border border-dashed border-border/70 bg-muted/20 p-3 text-xs text-muted-foreground">
                    <p>采购单号：{selectedPurchase.purchaseNumber}</p>
                    <p>物品：{selectedPurchase.itemName}</p>
                    <p>组织：{selectedPurchase.organizationType === 'school' ? '学校' : '单位'}</p>
                    <p>采购数量：{Number(selectedPurchase.quantity ?? 0)}</p>
                    <p>已入库：{Number(selectedPurchase.inboundQuantity ?? 0)}</p>
                    <p>剩余可入库：{remainingQuantity}</p>
                </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                    <Label htmlFor="inbound-item" className="text-sm font-medium">
                        商品
                    </Label>
                    <Select value={payload.itemId || undefined} disabled>
                        <SelectTrigger id="inbound-item" className="w-full">
                            <SelectValue placeholder="选择采购单后自动带出" />
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
                    <Label htmlFor="inbound-warehouse" className="text-sm font-medium">
                        仓库
                    </Label>
                    <Select value={payload.warehouseId || undefined} disabled>
                        <SelectTrigger id="inbound-warehouse" className="w-full">
                            <SelectValue placeholder="选择采购单后自动带出" />
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
            <p className="text-xs text-muted-foreground">
                商品和仓库按采购单自动带出并锁定，仅可修改数量与备注。
                {selectedWarehouse ? ` 当前仓库：${selectedWarehouse.name}` : ''}
            </p>

            <div className="space-y-2">
                <Label htmlFor="inbound-quantity" className="text-sm font-medium">
                    数量
                </Label>
                <Input
                    id="inbound-quantity"
                    type="number"
                    min={MIN_INBOUND_QUANTITY}
                    step="0.001"
                    max={Math.max(MIN_INBOUND_QUANTITY, remainingQuantity)}
                    value={payload.quantity}
                    onChange={(event) => {
                        const raw = Number(event.target.value);
                        const normalized = Number.isFinite(raw) ? raw : 0;
                        if (remainingQuantity > 0) {
                            handleChange(
                                'quantity',
                                Math.min(Math.max(MIN_INBOUND_QUANTITY, normalized), remainingQuantity)
                            );
                            return;
                        }
                        handleChange('quantity', Math.max(MIN_INBOUND_QUANTITY, normalized));
                    }}
                    required
                    disabled={submitting}
                />
                <p className="text-xs text-muted-foreground">剩余可入库：{remainingQuantity} 件</p>
            </div>

            <div className="space-y-2">
                <Label htmlFor="inbound-notes" className="text-sm font-medium">
                    备注
                </Label>
                <Textarea
                    id="inbound-notes"
                    value={payload.notes ?? ''}
                    onChange={(event) => handleChange('notes', event.target.value)}
                    rows={2}
                    placeholder="手动填写备注（可选）"
                    disabled={submitting}
                />
            </div>

            {!hideActions && (
                <div className="flex justify-end gap-3 pt-2">
                    {onCancel && (
                        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={submitting}>
                            取消
                        </Button>
                    )}
                    <Button type="submit" size="sm" disabled={submitting}>
                        {submitting ? '提交中...' : '创建入库单'}
                    </Button>
                </div>
            )}
        </form>
    );
}
