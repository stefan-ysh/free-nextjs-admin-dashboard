import { useState } from 'react';
import { Download, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';

import DataState from '@/components/common/DataState';
import type { InventoryMovement } from '@/types/inventory';
import { formatDateTimeLocal } from '@/lib/dates';
import { exportDeliveryNote, type DeliveryNoteData } from '@/lib/excel-export';

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
  inbound: 'text-green-600 bg-green-50 dark:text-green-300 dark:bg-green-500/10',
  outbound: 'text-rose-600 bg-rose-50 dark:text-rose-300 dark:bg-rose-500/10',
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
      date: new Date().toISOString().slice(0, 10),
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
    <div className="space-y-4">
      {/* 工具栏 */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between rounded-lg border border-blue-100 bg-blue-50 px-4 py-2 text-blue-700 dark:border-blue-900/50 dark:bg-blue-900/20 dark:text-blue-300">
          <span className="text-sm font-medium">已选择 {selectedIds.size} 项</span>
          <button
            onClick={handleExport}
            className="flex items-center gap-2 rounded-md bg-white px-3 py-1.5 text-sm font-medium text-blue-600 shadow-sm hover:bg-blue-50 hover:text-blue-700 dark:bg-gray-800 dark:text-blue-400 dark:hover:bg-gray-700"
          >
            <Download className="h-4 w-4" />
            导出发货单
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="max-h-[calc(100vh-350px)] overflow-auto custom-scrollbar">
          <table className="min-w-full divide-y divide-gray-200 text-sm whitespace-nowrap dark:divide-gray-700">
            <thead className="sticky top-0 z-10 bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
              <tr>
                <th className="px-4 py-3 w-10">
                  <button onClick={toggleSelectAll} className="flex items-center justify-center text-gray-400 hover:text-gray-600">
                    {isAllSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                  </button>
                </th>
                <th className="px-4 py-3 text-left">单据时间</th>
                <th className="px-4 py-3 text-left">SKU</th>
                <th className="px-4 py-3 text-left">仓库</th>
                <th className="px-4 py-3 text-left">方向</th>
                <th className="px-4 py-3 text-left">数量</th>
                <th className="px-4 py-3 text-left">单据号</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10">
                    <DataState variant="loading" description="库存流水正在加载" />
                  </td>
                </tr>
              ) : movements.length ? (
                movements.map((movement) => {
                  const isOutbound = movement.direction === 'outbound';
                  const isSelected = selectedIds.has(movement.id);

                  return (
                    <tr key={movement.id} className={isSelected ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''}>
                      <td className="px-4 py-3">
                        {isOutbound && (
                          <button
                            onClick={() => toggleSelect(movement.id)}
                            className={`flex items-center justify-center ${isSelected ? 'text-blue-600' : 'text-gray-300 hover:text-gray-500'}`}
                          >
                            {isSelected ? <CheckSquare className="h-4 w-4" /> : <Square className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        {formatDateTimeLocal(movement.occurredAt) ?? movement.occurredAt}
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">
                        <span
                          className="block max-w-[220px] truncate"
                          title={`${movement.itemName ?? movement.itemId} (#${movement.itemId})`}
                        >
                          {(movement.itemName ?? '未命名商品') + ` (#${movement.itemId})`}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                        <span className="block max-w-[120px] truncate" title={movement.warehouseName ?? movement.warehouseId}>
                          {movement.warehouseName ?? movement.warehouseId}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${directionBadge[movement.direction]}`}>
                          {movement.direction === 'inbound' ? '入库' : '出库'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-900 dark:text-white">
                        <span title={movement.unitCost ? `单价 ¥${movement.unitCost.toLocaleString()}` : undefined}>
                          {movement.quantity}
                          {movement.unitCost ? `（¥${movement.unitCost.toLocaleString()}）` : ''}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                        <span className="block max-w-[140px] truncate" title={movement.relatedOrderId ?? '—'}>
                          {movement.relatedOrderId ?? '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-10">
                    <DataState
                      variant="empty"
                      title={emptyHint || '暂无库存流水'}
                      description="调整筛选条件或导入历史记录"
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
