import DataState from '@/components/common/DataState';
import type { InventoryMovement } from '@/types/inventory';
import { formatDateTimeLocal } from '@/lib/dates';

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
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 text-sm dark:divide-gray-700">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500 dark:bg-gray-800 dark:text-gray-400">
            <tr>
              <th className="px-4 py-3 text-left">单据时间</th>
              <th className="px-4 py-3 text-left">SKU</th>
              <th className="px-4 py-3 text-left">仓库</th>
              <th className="px-4 py-3 text-left">方向</th>
              <th className="px-4 py-3 text-left">数量</th>
              <th className="px-4 py-3 text-left">规格</th>
              <th className="px-4 py-3 text-left">类型</th>
              <th className="px-4 py-3 text-left">单据号</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-4 py-10">
                  <DataState variant="loading" description="库存流水正在加载" />
                </td>
              </tr>
            ) : movements.length ? (
              movements.map((movement) => (
                <tr key={movement.id}>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                    {formatDateTimeLocal(movement.occurredAt) ?? movement.occurredAt}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900 dark:text-white">{movement.itemName ?? movement.itemId}</p>
                    <p className="text-xs text-gray-500">#{movement.itemId}</p>
                  </td>
                  <td className="px-4 py-3 text-gray-700 dark:text-gray-200">
                    {movement.warehouseName ?? movement.warehouseId}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${directionBadge[movement.direction]}`}>
                      {movement.direction === 'inbound' ? '入库' : '出库'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-900 dark:text-white">
                    {movement.quantity}
                    {movement.unitCost ? (
                      <span className="ml-2 text-xs text-gray-500">
                        ¥{movement.unitCost.toLocaleString()}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {movement.specSummary ?? renderAttributes(movement.attributes)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700 capitalize dark:text-gray-200">{movement.type}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {movement.relatedOrderId ?? '—'}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-10">
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
  );
}
