import { useState } from 'react';
import { Download, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';

import DataState from '@/components/common/DataState';
import type { InventoryMovement } from '@/types/inventory';
import { formatDateOnly, formatDateTimeLocal } from '@/lib/dates';
import { exportDeliveryNote, type DeliveryNoteData } from '@/lib/excel-export';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export type InventoryMovementRow = InventoryMovement & {
  itemName?: string;
  warehouseName?: string;
  specSummary?: string;
};

interface InventoryMovementsTableProps {
  movements: InventoryMovementRow[];
  loading?: boolean;
  emptyHint?: string;
}

const directionBadge: Record<InventoryMovement['direction'], string> = {
  inbound: 'text-chart-5 bg-chart-5/15',
  outbound: 'text-destructive bg-destructive/15',
};

function renderAttributes(attributes?: Record<string, string>) {
  if (!attributes || !Object.keys(attributes).length) {
    return '—';
  }
  return Object.entries(attributes)
    .map(([key, value]) => `${key}: ${value}`)
    .join(' · ');
}

export default function InventoryMovementsTable({ movements, loading, emptyHint }: InventoryMovementsTableProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // 仅允许选择出库记录
  const outboundMovements = movements.filter(m => m.direction === 'outbound');
  const isAllSelected = outboundMovements.length > 0 && selectedIds.size === outboundMovements.length;

  const toggleSelectAll = () => {
    if (isAllSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(outboundMovements.map(m => m.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleExport = async () => {
    if (selectedIds.size === 0) return;

    const selectedMovements = movements.filter(m => selectedIds.has(m.id));

    // 检查是否包含非出库记录（理论上UI限制了，但双重保险）
    if (selectedMovements.some(m => m.direction !== 'outbound')) {
      toast.error('发货单仅支持出库记录');
      return;
    }

    // 检查客户一致性
    const firstClient = selectedMovements[0].clientName;
    if (selectedMovements.some(m => m.clientName !== firstClient)) {
      toast.warning('选中记录包含不同的客户，建议分批导出');
      // 继续导出，但提醒用户
    }

    const exportData: DeliveryNoteData = {
      customerName: firstClient || '未知客户',
      contactPerson: selectedMovements[0].clientContact,
      phone: selectedMovements[0].clientPhone,
      address: selectedMovements[0].clientAddress,
      date: formatDateOnly(new Date()) ?? '',
      items: selectedMovements.map(m => ({
        name: m.itemName || '未命名商品',
        spec: m.specSummary || renderAttributes(m.attributes),
        quantity: m.quantity,
        unit: '个', // 暂时写死，理想情况应该从 item 获取 unit
        price: m.amount && m.quantity ? m.amount / m.quantity : undefined,
      })),
    };

    try {
      await exportDeliveryNote(exportData);
      toast.success('发货单导出成功');
      setSelectedIds(new Set()); // 导出后清空选择
    } catch (error) {
      console.error(error);
      toast.error('导出失败，请检查模板文件');
    }
  };

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-4">
      {/* 工具栏 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-primary/30 bg-primary/10 px-4 py-2 text-primary">
          <span className="text-sm font-medium">已选择 {selectedIds.size} 项</span>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-md bg-card px-3 py-1.5 text-sm font-medium text-primary shadow-sm hover:bg-primary/10"
          >
            <Download className="h-4 w-4" />
            导出发货单
          </button>
        </div>
      )}

      <div className="surface-table flex-1 min-h-0 flex flex-col">
        <div className="max-h-[calc(100vh-350px)] overflow-auto custom-scrollbar">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-muted/60 text-xs uppercase text-muted-foreground">
              <TableRow>
                <TableHead className="w-10">
                  <button onClick={toggleSelectAll} className="flex items-center justify-center text-muted-foreground hover:text-foreground">
                    {isAllSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                </TableHead>
                <TableHead className="text-left hidden md:table-cell">单据时间</TableHead>
                <TableHead className="text-left">SKU</TableHead>
                <TableHead className="text-left hidden md:table-cell">仓库</TableHead>
                <TableHead className="text-left">方向</TableHead>
                <TableHead className="text-left">数量</TableHead>
                <TableHead className="text-left hidden md:table-cell">单据号</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={9} className="py-10">
                    <DataState variant="loading" description="库存流水正在加载" />
                  </TableCell>
                </TableRow>
              ) : movements.length ? (
                movements.map((movement) => {
                  const isOutbound = movement.direction === 'outbound';
                  const isSelected = selectedIds.has(movement.id);

                  return (
                    <TableRow key={movement.id} className={isSelected ? 'bg-primary/10' : ''}>
                      <TableCell>
                        {isOutbound && (
                          <button
                            onClick={() => toggleSelect(movement.id)}
                            className={`flex items-center justify-center ${isSelected ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                          >
                            {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="text-foreground/90 hidden md:table-cell">
                        {formatDateTimeLocal(movement.occurredAt) ?? movement.occurredAt}
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <span
                          className="block max-w-[220px] truncate"
                          title={`${movement.itemName ?? movement.itemId} (#${movement.itemId})`}
                        >
                          {(movement.itemName ?? '未命名商品') + ` (#${movement.itemId})`}
                        </span>
                      </TableCell>
                      <TableCell className="text-foreground/90 hidden md:table-cell">
                        <span className="block max-w-[120px] truncate" title={movement.warehouseName ?? movement.warehouseId}>
                          {movement.warehouseName ?? movement.warehouseId}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${directionBadge[movement.direction]}`}>
                          {movement.direction === 'inbound' ? '入库' : '出库'}
                        </span>
                      </TableCell>
                      <TableCell className="text-foreground">
                        <span title={movement.unitCost ? `单价 ¥${movement.unitCost.toLocaleString()}` : undefined}>
                          {movement.quantity}
                          {movement.unitCost ? `（¥${movement.unitCost.toLocaleString()}）` : ''}
                        </span>
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden md:table-cell">
                        <span className="block max-w-[140px] truncate" title={movement.relatedOrderId ?? '—'}>
                          {movement.relatedOrderId ?? '—'}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={9} className="py-10">
                    <DataState
                      variant="empty"
                      title={emptyHint || '暂无库存流水'}
                      description="调整筛选条件或导入历史记录"
                    />
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
