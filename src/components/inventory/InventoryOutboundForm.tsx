'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import type {
    InventoryItem,
    InventoryOutboundPayload,
    Warehouse,
} from '@/types/inventory';
import type { Client } from '@/types/client';
import { usePermissions } from '@/hooks/usePermissions';
import { specFieldsToDefaultRecord } from '@/lib/inventory/spec';
import CustomerPicker from '@/components/common/CustomerPicker';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const defaultPayload: InventoryOutboundPayload = {
    itemId: '',
    warehouseId: '',
    quantity: 1,
    type: 'sale',
    clientId: undefined,
    targetWarehouseId: undefined,
};
const FORM_GRID_CLASS = 'grid gap-5 grid-cols-1 md:grid-cols-3 lg:grid-cols-6';
const FIELD_CLASS = 'w-full lg:col-span-1';

interface InventoryOutboundFormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
    formId?: string;
    hideActions?: boolean;
}

export default function InventoryOutboundForm({ onSuccess, onCancel, formId, hideActions = false }: InventoryOutboundFormProps) {
    const { hasPermission, loading: permissionLoading } = usePermissions();
    const canOperate = useMemo(
        () => hasPermission('INVENTORY_OPERATE_OUTBOUND'),
        [hasPermission]
    );

    const [items, setItems] = useState<InventoryItem[]>([]);
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
    const [payload, setPayload] = useState<InventoryOutboundPayload>(defaultPayload);
    const [submitting, setSubmitting] = useState(false);
    const [selectedClient, setSelectedClient] = useState<Client | null>(null);
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
        field: keyof InventoryOutboundPayload,
        value: InventoryOutboundPayload[keyof InventoryOutboundPayload]
    ) => {
        setPayload((prev) => ({ ...prev, [field]: value }));
    };

    useEffect(() => {
        if (payload.type !== 'transfer') return;
        setSelectedClient(null);
        setPayload((prev) => ({
            ...prev,
            clientId: undefined,
            clientType: undefined,
            clientName: undefined,
            clientContact: undefined,
            clientPhone: undefined,
            clientAddress: undefined,
        }));
    }, [payload.type]);

    const handleSpecChange = (key: string, value: string) => {
        setPayload((prev) => ({
            ...prev,
            attributes: {
                ...(prev.attributes ?? {}),
                [key]: value,
            },
        }));
    };

    const handleClientChange = (client: Client | null) => {
        setSelectedClient(client);
        setPayload((prev) => ({
            ...prev,
            clientId: client?.id,
            clientType: client?.type,
            clientName: client?.displayName,
            clientContact: client?.contactPerson,
            clientPhone: client?.mobile,
            clientAddress: client?.shippingAddress?.street ?? client?.billingAddress?.street,
        }));
    };

    useEffect(() => {
        if (!selectedItem) return;
        const defaultAttributes = specFieldsToDefaultRecord(selectedItem.specFields);
        setPayload((prev) => ({
            ...prev,
            attributes: prev.attributes ?? defaultAttributes ?? {},
        }));
    }, [selectedItem]);

    const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!canOperate || !payload.itemId || !payload.warehouseId) {
            toast.info("请选择商品与仓库");
            return;
        }
        if (payload.type === 'transfer') {
            if (!payload.targetWarehouseId) {
                toast.info('请选择调拨到的目标仓库');
                return;
            }
            if (payload.targetWarehouseId === payload.warehouseId) {
                toast.info('目标仓库不能与来源仓库相同');
                return;
            }
        }
        if (selectedClient && selectedClient.status === 'blacklisted') {
            toast.info('当前客户已被列入黑名单，无法发起出库');
            return;
        }
        setSubmitting(true);
        toast.dismiss();
        try {
            const res = await fetch('/api/inventory/outbound', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) {
                const error = await res.json();
                toast.error(error.error ?? '创建失败');
            } else {
                toast.success('出库单创建成功');
                setPayload({ ...defaultPayload });
                setSelectedClient(null);
                onSuccess?.();
            }
        } catch (error) {
            console.error('Failed to create outbound record', error);
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
                当前账户无权创建出库单。
            </div>
        );
    }

    return (
        <form id={formId} onSubmit={handleSubmit} className="space-y-5">
            <div className={FORM_GRID_CLASS}>
            <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="outbound-item" className="text-sm font-medium">
                    商品
                </Label>
                <Select
                    value={payload.itemId || undefined}
                    onValueChange={(value) => handleChange('itemId', value)}
                    disabled={submitting}
                >
                    <SelectTrigger id="outbound-item" className="w-full">
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

            {selectedItem && payload.type !== 'transfer' && (
                <div className="space-y-1 rounded-lg border border-dashed border-chart-3/40 bg-chart-3/10 p-3 text-sm text-chart-3 lg:col-span-3">
                    <div>
                        建议售价：¥{selectedItem.salePrice.toLocaleString()} / {selectedItem.unit}
                    </div>
                    <div className="text-xs opacity-80">
                        最新采购成本 ¥{selectedItem.unitPrice.toLocaleString()}，毛利率
                        {selectedItem.salePrice > 0
                            ? ` ${(Math.max(selectedItem.salePrice - selectedItem.unitPrice, 0) / selectedItem.salePrice * 100).toFixed(1)}%`
                            : ' —'}
                    </div>
                </div>
            )}

            {selectedItem?.specFields?.length ? (
                <div className={`${FORM_GRID_CLASS} lg:col-span-6`}>
                    {selectedItem.specFields.map((field) => {
                        const specValue = payload.attributes?.[field.key] ?? '';
                        return (
                            <div key={field.key} className={`space-y-2 ${FIELD_CLASS}`}>
                                <Label className="text-sm font-medium">{field.label}</Label>
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

                <div className={`space-y-2 ${FIELD_CLASS}`}>
                    <Label htmlFor="outbound-warehouse" className="text-sm font-medium">
                        仓库
                    </Label>
                    <Select
                        value={payload.warehouseId || undefined}
                        onValueChange={(value) => handleChange('warehouseId', value)}
                        disabled={submitting}
                    >
                        <SelectTrigger id="outbound-warehouse" className="w-full">
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
                <div className={`space-y-2 ${FIELD_CLASS}`}>
                    <Label htmlFor="outbound-type" className="text-sm font-medium">
                        出库类型
                    </Label>
                    <Select
                        value={payload.type}
                        onValueChange={(value) => handleChange('type', value as InventoryOutboundPayload['type'])}
                        disabled={submitting}
                    >
                        <SelectTrigger id="outbound-type" className="w-full">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="sale">销售出库</SelectItem>
                            <SelectItem value="transfer">调拨出库</SelectItem>
                            <SelectItem value="adjust">盘亏调整</SelectItem>
                            <SelectItem value="return">退还供应商</SelectItem>
                        </SelectContent>
                    </Select>
                </div>

            {payload.type === 'transfer' && (
                <div className={`space-y-2 ${FIELD_CLASS}`}>
                    <Label htmlFor="outbound-target-warehouse" className="text-sm font-medium">
                        目标仓库
                    </Label>
                    <Select
                        value={payload.targetWarehouseId || undefined}
                        onValueChange={(value) => handleChange('targetWarehouseId', value)}
                        disabled={submitting}
                    >
                        <SelectTrigger id="outbound-target-warehouse" className="w-full">
                            <SelectValue placeholder="选择目标仓库" />
                        </SelectTrigger>
                        <SelectContent>
                            {warehouses
                                .filter((warehouse) => warehouse.id !== payload.warehouseId)
                                .map((warehouse) => (
                                    <SelectItem key={warehouse.id} value={warehouse.id}>
                                        {warehouse.name}
                                    </SelectItem>
                                ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {(payload.type === 'sale' || payload.type === 'return') && (
                <>
                        <div className="space-y-2 lg:col-span-3">
                            <Label className="text-sm font-medium">出库客户</Label>
                            <CustomerPicker
                                value={payload.clientId}
                                onChange={handleClientChange}
                                disabled={submitting}
                                helperText="选定客户后将同步联系方式与开票信息"
                            />
                        </div>

                        <div className="space-y-2 lg:col-span-3">
                            <Label className="text-sm font-medium">收件人 / 联系人</Label>
                            <Input
                                value={payload.clientContact ?? ''}
                                onChange={(event) => handleChange('clientContact', event.target.value)}
                                placeholder="若客户方有具体联系人可填写"
                                disabled={submitting}
                            />
                        </div>
                        <div className="space-y-2 lg:col-span-3">
                            <Label className="text-sm font-medium">联系电话</Label>
                            <Input
                                value={payload.clientPhone ?? ''}
                                onChange={(event) => handleChange('clientPhone', event.target.value)}
                                disabled={submitting}
                            />
                        </div>
                        <div className="space-y-2 lg:col-span-3">
                            <Label className="text-sm font-medium">收货地址</Label>
                            <Textarea
                                value={payload.clientAddress ?? ''}
                                onChange={(event) => handleChange('clientAddress', event.target.value)}
                                rows={2}
                                placeholder="填写客户的送货地址，方便仓库打单"
                                disabled={submitting}
                            />
                        </div>
                </>
            )}

                <div className={`space-y-2 ${FIELD_CLASS}`}>
                    <Label htmlFor="outbound-quantity" className="text-sm font-medium">
                        数量
                    </Label>
                    <Input
                        id="outbound-quantity"
                        type="number"
                        min={1}
                        value={payload.quantity}
                        onChange={(event) => handleChange('quantity', Number(event.target.value))}
                        required
                        disabled={submitting}
                    />
                </div>
                <div className={`space-y-2 ${FIELD_CLASS}`}>
                    <Label htmlFor="outbound-related" className="text-sm font-medium">
                        关联单据号
                    </Label>
                    <Input
                        id="outbound-related"
                        type="text"
                        value={payload.relatedOrderId ?? ''}
                        onChange={(event) => handleChange('relatedOrderId', event.target.value)}
                        placeholder="如销售单、领用单"
                        disabled={submitting}
                    />
                </div>

            <div className="space-y-2 lg:col-span-3">
                <Label htmlFor="outbound-notes" className="text-sm font-medium">
                    备注
                </Label>
                <Textarea
                    id="outbound-notes"
                    value={payload.notes ?? ''}
                    onChange={(event) => handleChange('notes', event.target.value)}
                    rows={2}
                    placeholder="可填写客户、项目等信息"
                    disabled={submitting}
                />
            </div>
            </div>

            {!hideActions && (
                <div className="flex justify-end gap-3 pt-2">
                    {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel} disabled={submitting}>
                            取消
                        </Button>
                    )}
                    <Button type="submit" disabled={submitting}>
                        {submitting ? '提交中...' : '创建出库单'}
                    </Button>
                </div>
            )}
        </form>
    );
}
